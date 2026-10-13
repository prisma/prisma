import type {
  ActivityParent,
  ClientActivity,
  ClientActivityEnd,
  ClientActivityKind,
  ClientActivityResult,
  RuntimeExecuteOptions,
  StartActivity,
} from '@internal/framework-components/runtime';
import type { SqlExecutionPlan, SqlQueryPlan } from '@internal/sql-relational-core/plan';
import type { RuntimeScope } from '@internal/sql-relational-core/types';
import { invariant } from '@internal/utils/assertions';
import type { RuntimeQueryable, RuntimeTransaction } from './sql-runtime';

/** What starts client activities and hashes plans. The runtime's queryables carry one through `activitySource`; an activity handle has the members itself. */
export interface ActivitySource {
  /**
   * Starts an activity for an act the runtime would not otherwise see, such as an ORM call. Statements and activities started through the handle are its children. An open handle on the runtime keeps the runtime busy, so `close()` waits for its `end()`; a handle never ended keeps it busy, as a connection never released does.
   */
  startActivity<K extends ClientActivityKind>(
    activity: StartActivity<K>,
  ): Promise<ActivityHandle<K>>;
  /** The digest `ctx.contentHash(exec)` returns for the execution plan of the statement `plan` sends, when no `beforeEncode` hook changes its parameters and its codecs encode deterministically: after `beforeCompile`, lowering and encoding, without `beforeEncode`. It starts nothing, so it also works on a handle that has ended. */
  planContentHash(plan: SqlQueryPlan | SqlExecutionPlan): Promise<string>;
}

/** An open client activity, to send its statements through and to end. */
export interface ActivityHandle<K extends ClientActivityKind>
  extends RuntimeQueryable,
    ActivitySource {
  readonly activity: ClientActivity<K>;
  /** Set when an `intercept.onActivity` handler supplied the result; the client then returns it without running anything. */
  readonly intercepted: { readonly result: ClientActivityResult<K> } | undefined;
  /** Starts a transaction beneath the activity. Absent on a handle opened under a transaction, or on a connection whose transaction is open. */
  readonly transaction?: () => Promise<RuntimeTransaction>;
  /** Ends the activity. Rejects with `RUNTIME.ACTIVITY_CHILDREN_OPEN` when a statement or activity beneath it has not ended, after ending it `failed`. */
  end(end: ClientActivityEnd<K>): Promise<void>;
}

/** Options the runtime passes between its own queryables: the activity a statement starts beneath. */
export interface ActivityExecuteOptions extends RuntimeExecuteOptions {
  readonly activityParent?: ActivityParent | undefined;
}

/** The internal member through which a runtime, connection, transaction or `withTransaction` context starts activities; user-facing types do not show it. */
export const activitySource = Symbol('activitySource');

export interface ActivitySourceTarget {
  readonly [activitySource]: ActivitySource;
}

function hasActivitySourceMember(
  target: RuntimeScope,
): target is RuntimeScope & ActivitySourceTarget {
  return activitySource in target;
}

function isActivitySource(target: RuntimeScope): target is RuntimeScope & ActivitySource {
  return 'startActivity' in target && 'planContentHash' in target;
}

/** The activity source of a queryable, from its `activitySource` member or, for an activity handle, the handle itself; `undefined` for a queryable that cannot start activities, such as a test stub. */
export function findActivitySource(target: RuntimeScope): ActivitySource | undefined {
  if (hasActivitySourceMember(target)) return target[activitySource];
  return isActivitySource(target) ? target : undefined;
}

function activitySourceOf(target: RuntimeScope): ActivitySource {
  const source = findActivitySource(target);
  invariant(source !== undefined, 'The queryable cannot start activities');
  return source;
}

/** An activity source that starts activities on whatever queryable `target()` returns when called, for an object that sends its statements to a queryable it looks up each time. */
export function delegatingActivitySource(target: () => RuntimeScope): ActivitySource {
  return {
    startActivity: (activity) => startActivityOn(target(), activity),
    planContentHash: (plan) => planContentHashOn(target(), plan),
  };
}

/** Starts an activity on a queryable through its `activitySource` member, or on an activity handle. */
export function startActivityOn<K extends ClientActivityKind>(
  target: RuntimeScope,
  activity: StartActivity<K>,
): Promise<ActivityHandle<K>> {
  return activitySourceOf(target).startActivity(activity);
}

export function planContentHashOn(
  target: RuntimeScope,
  plan: SqlQueryPlan | SqlExecutionPlan,
): Promise<string> {
  return activitySourceOf(target).planContentHash(plan);
}
