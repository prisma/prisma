import { AsyncIterableResult } from '@internal/framework-components/runtime';

/** A result whose rows come from `rows()`, called on the first read, so a failure in `rows()` rejects the read instead of throwing at the call. */
export function deferRows<Row>(rows: () => AsyncIterable<Row>): AsyncIterableResult<Row> {
  async function* read(): AsyncGenerator<Row, void, unknown> {
    yield* rows();
  }
  return new AsyncIterableResult(read());
}

/** The promise `work()` returns, or a rejected one when `work()` throws. */
export async function deferPromise<T>(work: () => PromiseLike<T>): Promise<T> {
  return work();
}
