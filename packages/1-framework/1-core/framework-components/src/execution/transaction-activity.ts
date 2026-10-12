import { InternalError } from '@internal/utils/internal-error';
import { brandedAnnotations } from '../annotations';
import {
  type ActivityChild,
  type ActivityParent,
  type ActivityRecord,
  createActivityRecord,
} from './activity-lifecycle';
import type {
  ActivityContext,
  ActivityContextFields,
  ActivityEndedResult,
  ActivityFinalizedResult,
  ActivityObserver,
  TransactionActivity,
} from './runtime-middleware';

/** How a transaction's `commit()` or `rollback()` settled. */
export type TransactionSettlement =
  | { readonly by: 'commit'; readonly outcome: 'succeeded' | 'failed' }
  | {
      readonly by: 'rollback';
      readonly outcome: 'succeeded' | 'failed';
      /** Whether `commit()` was called before this rollback. */
      readonly commitAttempted: boolean;
    };

/** An open transaction activity. Pass it as the `parent` of every statement sent while the transaction is open. */
export interface TransactionActivityRun<TContext extends ActivityContext = ActivityContext>
  extends ActivityParent {
  readonly activity: TransactionActivity;
  readonly ctx: TContext;
  /**
   * Ends the transaction: its `activityEnded` hooks, then the `activityFinalized` hooks of its children that have ended, in the order they started, then its own. Resolves after those hooks have run. A child still open is finalized when it ends, with this transaction's outcome; `end` does not wait for it. A second call does nothing. An `activityEnded` error after a successful settlement is rethrown once finalization has run.
   */
  end(settlement: TransactionSettlement): Promise<void>;
}

export interface TransactionActivityOptions<TContext extends ActivityContext> {
  readonly middleware: ReadonlyArray<ActivityObserver>;
  readonly context: ActivityContextFields<TContext>;
}

/**
 * Starts a transaction activity and runs its `activityStarted` hooks. When one of them throws, the transaction ends `failed`, is finalized `rolled-back`, and the error is rethrown.
 */
export async function startTransactionActivity<TContext extends ActivityContext>(
  options: TransactionActivityOptions<TContext>,
): Promise<TransactionActivityRun<TContext>> {
  const run = new TransactionActivityRunImpl<TContext>(options);
  try {
    await run.start();
  } catch (error) {
    await run.end({ by: 'rollback', outcome: 'failed', commitAttempted: false });
    throw error;
  }
  return run;
}

class TransactionActivityRunImpl<TContext extends ActivityContext>
  implements TransactionActivityRun<TContext>
{
  readonly activity: TransactionActivity;
  readonly ctx: TContext;
  readonly #record: ActivityRecord<TContext>;
  readonly #children: Array<{ readonly child: ActivityChild; ended: boolean }> = [];
  #aChildFailed = false;
  #ended = false;
  #finalized: ActivityFinalizedResult | undefined;

  constructor(options: TransactionActivityOptions<TContext>) {
    this.activity = {
      id: crypto.randomUUID(),
      kind: 'transaction',
      annotations: brandedAnnotations(undefined),
    };
    this.#record = createActivityRecord<TContext>(
      options.middleware,
      this.activity,
      options.context,
      undefined,
    );
    this.ctx = this.#record.ctx;
  }

  start(): Promise<void> {
    return this.#record.started();
  }

  adopt(child: ActivityChild): (outcome: ActivityEndedResult['outcome']) => Promise<void> {
    if (this.#ended) {
      throw new InternalError('An activity was started beneath a transaction that has ended');
    }
    const entry = { child, ended: false };
    this.#children.push(entry);
    return async (outcome) => {
      entry.ended = true;
      if (outcome === 'failed') this.#aChildFailed = true;
      if (this.#finalized !== undefined) await child.finalize(this.#finalized);
    };
  }

  async end(settlement: TransactionSettlement): Promise<void> {
    if (this.#ended) return;
    this.#ended = true;
    let endedError: { readonly error: unknown } | undefined;
    try {
      await this.#record.ended({ kind: 'transaction', outcome: settlement.outcome });
    } catch (error) {
      endedError = { error };
    }
    const finalized = this.#finalizedResult(settlement);
    this.#finalized = finalized;
    for (const { child, ended } of this.#children.splice(0)) {
      if (ended) await child.finalize(finalized);
    }
    await this.#record.finalize(finalized);
    if (endedError !== undefined) throw endedError.error;
  }

  #finalizedResult(settlement: TransactionSettlement): ActivityFinalizedResult {
    if (settlement.by === 'rollback') {
      return { outcome: settlement.commitAttempted ? 'unknown' : 'rolled-back' };
    }
    return {
      outcome: settlement.outcome === 'succeeded' && !this.#aChildFailed ? 'committed' : 'unknown',
    };
  }
}
