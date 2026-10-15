import {
  type AnnotationValue,
  AsyncIterableResult,
  type OperationKind,
} from '@internal/framework-components/runtime';
import type { Preparable, SqlQueryPlan } from '@internal/sql-relational-core/plan';
import {
  type ActivityHandle,
  type ActivitySource,
  findActivitySource,
  type PreparedStatement,
} from '@internal/sql-runtime';
import { canonicalStringify } from '@internal/utils/canonical-stringify';
import { hashContent } from '@internal/utils/hash-content';
import { ormError } from './orm-errors';
import type { RuntimeQueryable } from './types';

type Annotations = ReadonlyMap<string, AnnotationValue<unknown, OperationKind>>;

/** One terminal method call, run as an `orm-call` activity. */
export interface OrmCall<Result> {
  readonly method: string;
  readonly annotations: Annotations | undefined;
  /** What the call's content hash digests besides its kind and method. */
  readonly identity: (source: ActivitySource) => Promise<unknown>;
  /** Whether a value an `intercept.onActivity` handler supplied is a result of this call. */
  readonly accepts: (value: unknown) => value is Result;
}

export type CallIdentity = OrmCall<unknown>['identity'];

/** A read's identity is the content hash of the plan it sends first. */
export function planIdentity(plan: () => SqlQueryPlan): CallIdentity {
  return (source) => source.planContentHash(plan());
}

/** A prepared read's identity is the content hash of the statement with the parameters this execution binds. */
export function preparedIdentity(
  statement: PreparedStatement<unknown, unknown>,
  params: unknown,
): CallIdentity {
  return (source) => source.planContentHash({ statement, params });
}

/** A write's statements depend on earlier results, so its identity is the model it writes. */
export function modelIdentity(namespaceId: string, modelName: string): CallIdentity {
  return async () => ({ namespace: namespaceId, model: modelName });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const ormResults = {
  rows: <Row>(value: unknown): value is Row[] => Array.isArray(value),
  row: <Row>(value: unknown): value is Row => isRecord(value),
  rowOrNull: <Row>(value: unknown): value is Row | null => value === null || isRecord(value),
  count: (value: unknown): value is number => typeof value === 'number',
} as const;

async function ormCallContentHash(source: ActivitySource, call: OrmCall<unknown>): Promise<string> {
  return hashContent(
    canonicalStringify({
      kind: 'orm-call',
      method: call.method,
      identity: await call.identity(source),
    }),
  );
}

/** Starts the call in the same turn as the terminal method, so a runtime closed after the method returns waits for it; the hooks run once the content hash resolves. A failed hash rejects the start; when the start fails first, the hash's failure is not reported as unhandled. */
function startOrmCall<Result>(
  source: ActivitySource,
  call: OrmCall<Result>,
): Promise<ActivityHandle<'orm-call'>> {
  const contentHash = ormCallContentHash(source, call);
  contentHash.catch(() => undefined);
  return source.startActivity({
    kind: 'orm-call',
    contentHash,
    ...(call.annotations === undefined ? {} : { annotations: call.annotations }),
  });
}

async function interceptedResult<Result>(
  handle: ActivityHandle<'orm-call'>,
  call: OrmCall<Result>,
  intercepted: { readonly result: unknown },
): Promise<Result> {
  const { result } = intercepted;
  if (!call.accepts(result)) {
    await handle.end({ outcome: 'failed' });
    throw ormError(
      'ORM.INTERCEPTED_RESULT_INVALID',
      `A middleware answered ${call.method}() with a value that is not a result of ${call.method}()`,
      { meta: { method: call.method } },
    );
  }
  await handle.end({ outcome: 'succeeded' });
  return result;
}

/** Runs a terminal that resolves to one value as an `orm-call` activity on `queryable`, sending its statements through the activity's handle. */
export async function runOrmCall<Result>(
  queryable: RuntimeQueryable,
  call: OrmCall<Result>,
  run: (queryable: RuntimeQueryable) => Promise<Result>,
): Promise<Result> {
  const source = findActivitySource(queryable);
  if (source === undefined) return run(queryable);
  const handle = await startOrmCall(source, call);
  if (handle.intercepted !== undefined) {
    return interceptedResult(handle, call, handle.intercepted);
  }
  let result: Result;
  try {
    result = await run(handle);
  } catch (error) {
    await handle.end({ outcome: 'failed' });
    throw error;
  }
  await handle.end({ outcome: 'succeeded', result });
  return result;
}

/** Runs a terminal that streams rows as an `orm-call` activity on `queryable`. The call ends when the caller reads to the end, stops early or the stream fails; its result holds the rows only when it carries annotations. */
export function streamOrmCall<Row>(
  queryable: RuntimeQueryable,
  call: OrmCall<Row[]>,
  run: (queryable: RuntimeQueryable) => AsyncIterableResult<Row>,
): AsyncIterableResult<Row> {
  const source = findActivitySource(queryable);
  if (source === undefined) return run(queryable);
  const generator = async function* (): AsyncGenerator<Row, void, unknown> {
    const handle = await startOrmCall(source, call);
    if (handle.intercepted !== undefined) {
      yield* await interceptedResult(handle, call, handle.intercepted);
      return;
    }
    const collected: Row[] | undefined =
      call.annotations !== undefined && call.annotations.size > 0 ? [] : undefined;
    let outcome: 'succeeded' | 'failed' | 'stopped' = 'stopped';
    try {
      for await (const row of run(handle)) {
        collected?.push(row);
        yield row;
      }
      outcome = 'succeeded';
    } catch (error) {
      outcome = 'failed';
      throw error;
    } finally {
      await handle.end(
        outcome === 'succeeded' && collected !== undefined
          ? { outcome, result: collected }
          : { outcome },
      );
    }
  };
  return new AsyncIterableResult(generator());
}

const preparedOrmCall = Symbol('preparedOrmCall');

/** Runs one execution of a prepared ORM read as an `orm-call` activity: `rows` sends the prepared statement to the queryable it is given. */
export type PreparedOrmCall<DbRow, Result> = (
  target: RuntimeQueryable,
  rows: (queryable: RuntimeQueryable) => AsyncIterableResult<DbRow>,
  identity: CallIdentity,
) => Result;

interface PreparableOrmCall<DbRow, Result> extends Preparable<DbRow, Result> {
  readonly [preparedOrmCall]: PreparedOrmCall<DbRow, Result>;
}

/** Marks a prepared ORM read so each execution of the statement prepared from it runs as an `orm-call` activity. */
export function asPreparedOrmCall<DbRow, Result>(
  preparable: Preparable<DbRow, Result>,
  call: PreparedOrmCall<DbRow, Result>,
): Preparable<DbRow, Result> {
  const marked: PreparableOrmCall<DbRow, Result> = { ...preparable, [preparedOrmCall]: call };
  return marked;
}

function isPreparableOrmCall<DbRow, Result>(
  preparable: Preparable<DbRow, Result>,
): preparable is PreparableOrmCall<DbRow, Result> {
  return preparedOrmCall in preparable;
}

export function preparedOrmCallOf<DbRow, Result>(
  preparable: Preparable<DbRow, Result>,
): PreparedOrmCall<DbRow, Result> | undefined {
  return isPreparableOrmCall(preparable) ? preparable[preparedOrmCall] : undefined;
}

/** A prepared read that streams rows: each execution runs as {@link streamOrmCall}. */
export function preparedRowsCall<DbRow, Row>(
  method: string,
  annotations: Annotations | undefined,
  consume: (rows: AsyncIterableResult<DbRow>) => AsyncIterableResult<Row>,
): PreparedOrmCall<DbRow, AsyncIterableResult<Row>> {
  return (target, rows, identity) =>
    streamOrmCall(
      target,
      { method, annotations, identity, accepts: ormResults.rows<Row> },
      (queryable) => consume(rows(queryable)),
    );
}

/** A prepared read that resolves to one value: each execution runs as {@link runOrmCall}. */
export function preparedValueCall<DbRow, Result>(
  method: string,
  annotations: Annotations | undefined,
  consume: (rows: AsyncIterableResult<DbRow>) => Promise<Result>,
  accepts: (value: unknown) => value is Result,
): PreparedOrmCall<DbRow, Promise<Result>> {
  return (target, rows, identity) =>
    runOrmCall(target, { method, annotations, identity, accepts }, (queryable) =>
      consume(rows(queryable)),
    );
}
