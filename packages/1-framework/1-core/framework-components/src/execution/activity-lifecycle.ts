import { blindCast } from '@internal/utils/casts';
import type {
  ActivityContext,
  ActivityContextFields,
  ActivityEndedResult,
  ActivityFinalizedResult,
  ActivityObserver,
  RuntimeActivity,
} from './runtime-middleware';

/** An open activity that new activities can start beneath. */
export interface ActivityParent {
  readonly activity: RuntimeActivity;
  readonly ctx: ActivityContext;
  /** Records `child` in start order; the parent finalizes it. Returns what the child calls when it ends, which finalizes it when the parent has already ended. */
  adopt(child: ActivityChild): (outcome: ActivityEndedResult['outcome']) => Promise<void>;
}

/** What a parent holds of a child activity until it finalizes it. */
export interface ActivityChild {
  /** Runs the child's `activityFinalized` hooks; a second call does nothing. */
  finalize(result: ActivityFinalizedResult): Promise<void>;
}

export interface ActivityRecord<TContext extends ActivityContext> extends ActivityChild {
  readonly activity: RuntimeActivity;
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
  activity: RuntimeActivity,
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
 * Ends an activity: its `activityEnded` hooks, then its finalization, which a parent holds or which happens at once with `committed` or `unknown`. The finalization runs even when an `activityEnded` hook fails the activity; that error is rethrown afterwards.
 */
export async function endActivity(
  record: ActivityRecord<ActivityContext>,
  result: ActivityEndedResult,
  childEnded: ((outcome: ActivityEndedResult['outcome']) => Promise<void>) | undefined,
): Promise<void> {
  let endedError: { readonly error: unknown } | undefined;
  try {
    await record.ended(result);
  } catch (error) {
    endedError = { error };
  }
  if (childEnded === undefined) {
    await record.finalize({ outcome: result.outcome === 'succeeded' ? 'committed' : 'unknown' });
  } else {
    await childEnded(result.outcome);
  }
  if (endedError !== undefined) throw endedError.error;
}
