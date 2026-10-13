import type {
  ActivityParent,
  AnnotationValue,
  ClientActivity,
  ClientActivityEnd,
  ClientActivityKind,
  ClientActivityResult,
  OperationKind,
  RuntimeExecuteOptions,
} from '@internal/framework-components/runtime';
import type { SqlExecutionPlan, SqlQueryPlan } from '@internal/sql-relational-core/plan';
import type { RuntimeScope } from '@internal/sql-relational-core/types';
import { invariant } from '@internal/utils/assertions';
import type { RuntimeQueryable, RuntimeTransaction } from './sql-runtime';

/** What a client gives to start an activity. */
export interface StartActivity<K extends ClientActivityKind> {
  readonly kind: K;
  /** An opaque digest of what the activity does. For a plan, `planContentHash` gives the digest the runtime gives its statement. */
  readonly contentHash: string;
  readonly annotations?: ReadonlyMap<string, AnnotationValue<unknown, OperationKind>>;
}

/** The members that let a client start activities and hash plans. */
export interface ActivityQueryable {
  /**
   * Starts an activity for an act the runtime would not otherwise see, such as an ORM call. Statements and activities started through the handle are its children. An open handle on the runtime keeps the runtime busy, so `close()` waits for its `end()`; a handle never ended keeps it busy, as a connection never released does.
   */
  startActivity<K extends ClientActivityKind>(
    activity: StartActivity<K>,
  ): Promise<ActivityHandle<K>>;
  /** The digest `ctx.contentHash` gives the statement `plan` sends: after `beforeCompile`, lowering and encoding, without `beforeEncode`. */
  planContentHash(plan: SqlQueryPlan | SqlExecutionPlan): Promise<string>;
}

/** An open client activity, to send its statements through and to end. */
export interface ActivityHandle<K extends ClientActivityKind> extends RuntimeQueryable {
  readonly activity: ClientActivity<K>;
  /** Set when an `intercept.onActivity` handler supplied the result; the client then returns it without running anything. */
  readonly intercepted: { readonly result: ClientActivityResult<K> } | undefined;
  /** Starts a transaction beneath the activity. Absent on a handle opened under a transaction. */
  readonly transaction?: () => Promise<RuntimeTransaction>;
  /** Ends the activity. Rejects with `RUNTIME.ACTIVITY_CHILDREN_OPEN` when a statement or activity beneath it has not ended, after ending it `failed`. */
  end(end: ClientActivityEnd<K>): Promise<void>;
}

/** Options the runtime passes between its own queryables: the activity a statement starts beneath. */
export interface ActivityExecuteOptions extends RuntimeExecuteOptions {
  readonly activityParent?: ActivityParent | undefined;
}

export const activityQueryable = Symbol('activityQueryable');

/** A queryable whose activity members are internal, such as the context of `withTransaction`. */
export interface ActivityQueryableTarget {
  readonly [activityQueryable]: ActivityQueryable;
}

function hasActivityBridge(target: RuntimeScope): target is RuntimeScope & ActivityQueryableTarget {
  return activityQueryable in target;
}

function hasActivityMembers(target: RuntimeScope): target is RuntimeScope & ActivityQueryable {
  return 'startActivity' in target && 'planContentHash' in target;
}

function activityMembersOf(target: RuntimeScope): ActivityQueryable {
  if (hasActivityBridge(target)) return target[activityQueryable];
  invariant(hasActivityMembers(target), 'The queryable has no activity members');
  return target;
}

/** Starts an activity on a queryable that has the members directly or through `activityQueryable`. */
export function startActivityOn<K extends ClientActivityKind>(
  target: RuntimeScope,
  activity: StartActivity<K>,
): Promise<ActivityHandle<K>> {
  return activityMembersOf(target).startActivity(activity);
}

export function planContentHashOn(
  target: RuntimeScope,
  plan: SqlQueryPlan | SqlExecutionPlan,
): Promise<string> {
  return activityMembersOf(target).planContentHash(plan);
}
