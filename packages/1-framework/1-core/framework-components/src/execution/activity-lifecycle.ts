import { blindCast } from '@internal/utils/casts';
import { type RuntimeErrorEnvelope, runtimeError } from './runtime-error';
import type {
  Activity,
  ActivityBase,
  ActivityContext,
  ActivityContextFields,
  ActivityEndedResult,
  ActivityFinalizedResult,
  ActivityObserver,
} from './runtime-middleware';

/** An open activity that new activities can start beneath. */
export interface ActivityParent {
  readonly activity: ActivityBase;
  readonly ctx: ActivityContext;
  /** Records `child` in start order and returns how the child reports to this parent. Throws a runtime error when this parent has ended, or when the transaction it runs in has. */
  adopt(child: ActivityChild): ActivityChildSlot;
}

/** What a parent holds of a child activity until it is finalized. */
export interface ActivityChild {
  /** Runs the `activityFinalized` hooks of the children it holds, in the order they started and depth first, then its own. A second call does nothing. */
  finalize(result: ActivityFinalizedResult): Promise<void>;
}

/** How a child reports to its parent. */
export interface ActivityChildSlot {
  /** A statement at or beneath the child failed. The report travels up to the nearest transaction. */
  statementFailed(): void;
  /** The child has ended. `own` is its finalized result when no transaction finalizes it. Resolves once the child is finalized, or held for its transaction. */
  ended(own: ActivityFinalizedResult): Promise<void>;
  /** Whether the transaction the parent runs in has ended, so no work may start beneath the child. */
  transactionEnded(): boolean;
}

export interface ActivityChildrenOptions {
  /** Whether a transaction at or above the parent finalizes the children. Otherwise each child is finalized with its own result when it ends. */
  readonly inTransaction: boolean;
  /** Whether finished children are kept for the transaction to finalize. */
  readonly holdFinishedChildren: boolean;
  readonly statementFailed: () => void;
  readonly transactionEnded: () => boolean;
  /** Receives the result of each child finalized when it ends. */
  readonly childFinalized: (result: ActivityFinalizedResult) => void;
}

/** The children of a transaction or a client activity: which are open, and which have ended and wait to be finalized. */
export class ActivityChildren {
  readonly #options: ActivityChildrenOptions;
  readonly #held: Array<{ readonly child: ActivityChild; ended: boolean }> = [];
  #open = 0;
  #finalized: ActivityFinalizedResult | undefined;

  constructor(options: ActivityChildrenOptions) {
    this.#options = options;
  }

  /** The children that have started and not ended. */
  get open(): number {
    return this.#open;
  }

  add(child: ActivityChild): ActivityChildSlot {
    const options = this.#options;
    const entry =
      options.inTransaction && options.holdFinishedChildren ? { child, ended: false } : undefined;
    if (entry !== undefined) this.#held.push(entry);
    this.#open++;
    let ended = false;
    return {
      statementFailed: options.statementFailed,
      transactionEnded: options.transactionEnded,
      ended: async (own) => {
        if (ended) return;
        ended = true;
        this.#open--;
        if (!options.inTransaction) {
          options.childFinalized(own);
          await child.finalize(own);
        } else if (this.#finalized !== undefined) {
          await child.finalize(this.#finalized);
        } else if (entry !== undefined) {
          entry.ended = true;
        }
      },
    };
  }

  /** Finalizes the children that have ended, in start order, with `result`; a child that ends later is finalized with it then. */
  async finalize(result: ActivityFinalizedResult): Promise<void> {
    if (this.#finalized !== undefined) return;
    this.#finalized = result;
    for (const { child, ended } of this.#held.splice(0)) {
      if (ended) await child.finalize(result);
    }
  }
}

export function activityEndedError(
  parent: ActivityBase,
  reason: 'ended' | 'transaction-ended',
): RuntimeErrorEnvelope {
  const subject = parent.kind === 'transaction' ? 'a transaction' : `a '${parent.kind}' activity`;
  const state = reason === 'ended' ? 'that has ended' : 'whose transaction has ended';
  return runtimeError(
    'RUNTIME.ACTIVITY_ENDED',
    `An activity was started beneath ${subject} ${state}`,
    { parentKind: parent.kind, parentId: parent.id },
  );
}

export interface ActivityRecord<TContext extends ActivityContext> extends ActivityChild {
  readonly activity: Activity;
  readonly ctx: TContext;
  started(): Promise<void>;
  ended(result: ActivityEndedResult): Promise<void>;
}

/** The per-activity state behind `ctx.state(key)`: one object per key, created empty on first use. */
export interface ActivityStateStore {
  state(key: string | symbol): Record<string | symbol, unknown>;
  clear(): void;
}

export function createStateStore(): ActivityStateStore {
  let states: Map<string | symbol, Record<string | symbol, unknown>> | undefined;
  return {
    state(key) {
      states ??= new Map();
      let state = states.get(key);
      if (state === undefined) {
        state = {};
        states.set(key, state);
      }
      return state;
    },
    clear() {
      states = undefined;
    },
  };
}

export function createActivityRecord<TContext extends ActivityContext>(
  middleware: ReadonlyArray<ActivityObserver>,
  activity: Activity,
  fields: ActivityContextFields<TContext>,
  parent: ActivityParent | undefined,
): ActivityRecord<TContext> {
  const store = createStateStore();
  let finalized = false;
  // How many middleware ran activityStarted. A middleware after one whose activityStarted threw never saw the activity start, so it gets no later event for it.
  let started = middleware.length;
  const parentCtx = parent?.ctx;
  const parentIsTransaction = parent?.activity.kind === 'transaction';
  const ctx = blindCast<
    TContext,
    'the family context is its fields plus the members every activity context adds'
  >({
    ...fields,
    parent: parentCtx,
    state: store.state,
    inTransaction: () => parentIsTransaction || (parentCtx?.inTransaction() ?? false),
  });

  return {
    activity,
    ctx,
    async started() {
      for (let index = 0; index < middleware.length; index++) {
        const mw = middleware[index];
        if (!mw?.activityStarted) continue;
        try {
          await mw.activityStarted(activity, ctx);
        } catch (error) {
          started = index + 1;
          throw error;
        }
      }
    },
    async ended(result) {
      // Every middleware that saw the activity start sees it end. When the activity succeeded, the first error a hook throws fails it; after a failure the activity's own error reaches the caller, and hook errors go to the log.
      let firstError: { readonly error: unknown } | undefined;
      for (let index = 0; index < started; index++) {
        const mw = middleware[index];
        if (!mw?.activityEnded) continue;
        try {
          await mw.activityEnded(activity, result, ctx);
        } catch (error) {
          if (result.outcome === 'succeeded') firstError ??= { error };
          else logHookError(ctx, 'middleware.activityEnded.error', mw.name, error);
        }
      }
      if (firstError !== undefined) throw firstError.error;
    },
    async finalize(result) {
      if (finalized) return;
      finalized = true;
      for (let index = 0; index < started; index++) {
        const mw = middleware[index];
        if (!mw?.activityFinalized) continue;
        try {
          await mw.activityFinalized(activity, result, ctx);
        } catch (error) {
          logHookError(ctx, 'middleware.activityFinalized.error', mw.name, error);
        }
      }
      store.clear();
    },
  };
}

function logHookError(
  ctx: ActivityContext,
  event: string,
  middleware: string,
  error: unknown,
): void {
  try {
    ctx.log.error({ event, middleware, error });
  } catch {
    // A failing logger must not replace the error the caller receives.
  }
}

/**
 * Ends an activity: its `activityEnded` hooks, then its finalization, which its parent holds or performs, or which happens at once with `own` when it has no parent. The finalization runs even when an `activityEnded` hook fails the activity; that error is rethrown afterwards.
 */
export async function endActivity(
  record: Pick<ActivityRecord<ActivityContext>, 'ended'>,
  result: ActivityEndedResult,
  own: ActivityFinalizedResult,
  slot: ActivityChildSlot | undefined,
  finalize: (result: ActivityFinalizedResult) => Promise<void>,
): Promise<void> {
  let endedError: { readonly error: unknown } | undefined;
  try {
    await record.ended(result);
  } catch (error) {
    endedError = { error };
  }
  if (slot === undefined) {
    await finalize(own);
  } else {
    await slot.ended(own);
  }
  if (endedError !== undefined) throw endedError.error;
}
