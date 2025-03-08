import type { TransactionOptions } from '../Engine'
import type { JsonQuery } from '../types/JsonProtocol'
import type { QueryEngineBatchRequest } from '../types/QueryEngine'

export function getBatchRequestPayload(
  batch: JsonQuery[],
  transaction?: TransactionOptions<unknown>,
): QueryEngineBatchRequest {
  return {
    batch,
    transaction: transaction?.kind === 'batch' ? { isolationLevel: transaction.options.isolationLevel } : undefined,
  }
}
