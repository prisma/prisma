import type { JsonQuery } from '@prisma/json-protocol'

import { TransactionOptions } from '../Engine'
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
