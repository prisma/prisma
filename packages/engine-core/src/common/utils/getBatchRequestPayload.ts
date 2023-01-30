import { EngineQuery, TransactionOptions } from '../Engine'
import { QueryEngineBatchRequest } from '../types/QueryEngine'

export function getBatchRequestPayload(
  queries: EngineQuery[],
  transaction?: TransactionOptions<unknown>,
): QueryEngineBatchRequest {
  const batch = queries.map(({ query }) => ({ query, variables: {} }))
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
