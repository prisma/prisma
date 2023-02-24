import { EngineBatchQueries, EngineQuery, GraphQLQuery, TransactionOptions } from '../Engine'
import { QueryEngineBatchRequest } from '../types/QueryEngine'

export function getBatchRequestPayload(
  batch: EngineBatchQueries,
  transaction?: TransactionOptions<unknown>,
): QueryEngineBatchRequest {
  if (isGraphQLBatch(batch)) {
    if (!transaction || transaction.kind === 'itx') {
      return {
        batch,
        transaction: false,
      }
    }

    return {
      batch,
      transaction: true,
      isolationLevel: transaction.options.isolationLevel,
    }
  }

  return {
    batch,
    transaction: transaction?.kind === 'batch' ? { isolationLevel: transaction.options.isolationLevel } : undefined,
  }
}

function isGraphQLBatch(batch: EngineQuery[]): batch is GraphQLQuery[] {
  return typeof batch[0].query === 'string'
}
