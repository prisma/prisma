import { TransactionOptions } from '../Engine'
import { JsonQuery } from '../types/JsonProtocol'
import { QueryEngineBatchRequest } from '../types/QueryEngine'

export function getBatchRequestPayload(
  batch: JsonQuery[],
  transaction?: TransactionOptions<unknown>,
): QueryEngineBatchRequest {
  return {
    batch,
    transaction: transaction?.kind === 'batch' ? { isolationLevel: transaction.options.isolationLevel } : undefined,
  }
}
