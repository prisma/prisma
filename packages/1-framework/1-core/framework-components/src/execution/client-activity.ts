import { blindCast } from '@internal/utils/casts';
import { ifDefined } from '@internal/utils/defined';
import { type AnnotationValue, brandedAnnotations, type OperationKind } from '../annotations';
import {
  type ActivityChild,
  ActivityChildren,
  type ActivityChildSlot,
  type ActivityParent,
  type ActivityRecord,
  activityEndedError,
  createActivityRecord,
  endActivity,
} from './activity-lifecycle';
import { runtimeError } from './runtime-error';
import type {
  Activity,
  ActivityContext,
  ActivityContextFields,
  ActivityEndedResult,
  ActivityFinalizedResult,
  ActivityObserver,
  ClientActivity,
  ClientActivityKind,
  ClientActivityResult,
  RuntimeMiddleware,
} from './runtime-middleware';

/** What a client passes to end its activity. */
export interface ClientActivityEnd<K extends ClientActivityKind> {
  readonly outcome: 'succeeded' | 'failed' | 'stopped';
  /** The value the client returns to its caller. When omitted after an interception, the intercepted result. */
  readonly result?: ClientActivityResult<K>;
}

/** An open client activity. Pass it as the `parent` of every statement, transaction and client activity started beneath it. */
export interface ClientActivityRun<
  K extends ClientActivityKind,
  TContext extends ActivityContext = ActivityContext,
> extends ActivityParent {
  readonly activity: ClientActivity<K>;
  readonly ctx: TContext;
  /** Set when an `intercept.onActivity` handler supplied the result. */
  readonly intercepted: { readonly result: ClientActivityResult<K> } | undefined;
  /** Throws `RUNTIME.ACTIVITY_ENDED` when no statement or activity may start beneath this one any more. */
  assertOpen(): void;
  /**
   * Ends the activity: its `activityEnded` hooks, then its finalization. Outside a transaction it is finalized at once: `committed` when it succeeded and nothing beneath it was finalized `unknown`, otherwise `unknown`. Inside one, its transaction finalizes it. When a child has not ended, the activity ends `failed`, is finalized, and `end` rejects with `RUNTIME.ACTIVITY_CHILDREN_OPEN`. A second call rejects with `RUNTIME.ACTIVITY_ENDED`.
   */
  end(end: ClientActivityEnd<K>): Promise<void>;
}

export interface ClientActivityOptions<
  K extends ClientActivityKind,
  TContext extends ActivityContext,
> {
  readonly middleware: ReadonlyArray<ActivityObserver & Pick<RuntimeMiddleware, 'intercept'>>;
  readonly kind: K;
  readonly contentHash: string;
  readonly annotations: ReadonlyMap<string, AnnotationValue<unknown, OperationKind>> | undefined;
  readonly context: ActivityContextFields<TContext>;
  /** The open activity the client activity starts beneath. */
  readonly parent: ActivityParent | undefined;
  /** As for a transaction: whether finished children inside a transaction are kept for it to finalize. */
  readonly holdFinishedChildren: boolean;
}

const reservedKinds: ReadonlySet<string> = new Set(['statement', 'transaction']);

/**
 * Starts a client activity: its `activityStarted` hooks, then each `intercept.onActivity` handler in registration order until one returns a result. When a hook or a handler throws, the activity ends `failed`, is finalized, and the error is rethrown. Rejects at once, running no hook, when `kind` is `statement` or `transaction` or when `parent` no longer accepts work.
 */
export async function startClientActivity<
  K extends ClientActivityKind,
  TContext extends ActivityContext = ActivityContext,
>(options: ClientActivityOptions<K, TContext>): Promise<ClientActivityRun<K, TContext>> {
  const kind: string = options.kind;
  if (reservedKinds.has(kind)) {
    throw runtimeError(
      'RUNTIME.ACTIVITY_KIND_RESERVED',
      `A client cannot start an activity of kind '${kind}'; the runtime starts those itself`,
      { kind },
    );
  }
  const run = new ClientActivityRunImpl<K, TContext>(options);
  try {
    await run.start();
  } catch (error) {
    await run.finish({ outcome: 'failed', source: 'client' });
    throw error;
  }
  for (const mw of options.middleware) {
    const intercept = mw.intercept;
    if (intercept?.onActivity === undefined) continue;
    let intercepted: { readonly result: unknown } | undefined;
    try {
      intercepted = await intercept.onActivity(run.activity, run.ctx);
    } catch (error) {
      await run.finish({ outcome: 'failed', source: 'middleware' });
      throw error;
    }
    if (intercepted === undefined) continue;
    run.ctx.log.debug?.({ event: 'middleware.intercept.onActivity', middleware: mw.name });
    run.intercept(intercepted.result);
    break;
  }
  return run;
}

class ClientActivityRunImpl<K extends ClientActivityKind, TContext extends ActivityContext>
  implements ClientActivityRun<K, TContext>, ActivityChild
{
  readonly activity: ClientActivity<K>;
  readonly ctx: TContext;
  readonly #record: ActivityRecord<TContext>;
  readonly #children: ActivityChildren;
  readonly #slot: ActivityChildSlot | undefined;
  #intercepted: { readonly result: ClientActivityResult<K> } | undefined;
  #ended = false;
  #somethingBeneathUnknown = false;

  constructor(options: ClientActivityOptions<K, TContext>) {
    this.activity = {
      id: crypto.randomUUID(),
      kind: options.kind,
      contentHash: options.contentHash,
      annotations: options.annotations ?? brandedAnnotations(undefined),
    };
    this.#record = createActivityRecord<TContext>(
      options.middleware,
      blindCast<Activity, 'a client activity of a registered kind is one of the Activity members'>(
        this.activity,
      ),
      options.context,
      options.parent,
    );
    this.ctx = this.#record.ctx;
    this.#children = new ActivityChildren({
      inTransaction: this.ctx.inTransaction(),
      holdFinishedChildren: options.holdFinishedChildren,
      statementFailed: () => this.#slot?.statementFailed(),
      transactionEnded: () => this.#slot?.transactionEnded() ?? false,
      childFinalized: (result) => {
        if (result.outcome === 'unknown') this.#somethingBeneathUnknown = true;
      },
    });
    this.#slot = options.parent?.adopt(this);
  }

  get intercepted(): { readonly result: ClientActivityResult<K> } | undefined {
    return this.#intercepted;
  }

  start(): Promise<void> {
    return this.#record.started();
  }

  intercept(result: unknown): void {
    this.#intercepted = {
      result: blindCast<
        ClientActivityResult<K>,
        'the framework types intercepted results unknown; the client checks what it receives'
      >(result),
    };
  }

  assertOpen(): void {
    if (this.#ended) throw activityEndedError(this.activity, 'ended');
    if (this.#slot?.transactionEnded()) {
      throw activityEndedError(this.activity, 'transaction-ended');
    }
  }

  adopt(child: ActivityChild): ActivityChildSlot {
    this.assertOpen();
    return this.#children.add(child);
  }

  async end(end: ClientActivityEnd<K>): Promise<void> {
    if (this.#ended) {
      throw runtimeError(
        'RUNTIME.ACTIVITY_ENDED',
        `The '${this.activity.kind}' activity has already ended`,
        { kind: this.activity.kind, id: this.activity.id },
      );
    }
    const openChildren = this.#children.open;
    if (openChildren > 0) {
      await this.finish({ outcome: 'failed', source: 'client' });
      throw runtimeError(
        'RUNTIME.ACTIVITY_CHILDREN_OPEN',
        `The '${this.activity.kind}' activity ended while ${openChildren} activities beneath it had not ended`,
        { kind: this.activity.kind, id: this.activity.id, openChildren },
      );
    }
    const intercepted = this.#intercepted;
    if (end.result === undefined && intercepted !== undefined) {
      await this.finish({ outcome: end.outcome, source: 'middleware', result: intercepted.result });
    } else {
      await this.finish({ outcome: end.outcome, source: 'client', result: end.result });
    }
  }

  async finish(ended: {
    readonly outcome: ClientActivityEnd<K>['outcome'];
    readonly source: 'client' | 'middleware';
    readonly result?: ClientActivityResult<K> | undefined;
  }): Promise<void> {
    this.#ended = true;
    const result = blindCast<
      ActivityEndedResult,
      'the ended result of a registered kind is one of the ClientActivityEnded members'
    >({
      kind: this.activity.kind,
      outcome: ended.outcome,
      source: ended.source,
      ...ifDefined('result', ended.result),
    });
    const own: ActivityFinalizedResult = {
      outcome:
        ended.outcome === 'succeeded' && !this.#somethingBeneathUnknown ? 'committed' : 'unknown',
    };
    await endActivity(this.#record, result, own, this.#slot, (finalized) =>
      this.finalize(finalized),
    );
  }

  async finalize(result: ActivityFinalizedResult): Promise<void> {
    await this.#children.finalize(result);
    await this.#record.finalize(result);
  }
}
