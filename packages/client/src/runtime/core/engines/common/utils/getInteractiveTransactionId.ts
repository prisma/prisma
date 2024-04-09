import { TransactionOptions } from '../Engine'

export function getInteractiveTransactionId(transaction?: TransactionOptions<unknown>): string | undefined {
  if (transaction?.kind === 'itx') {
    return transaction.options.id
  }
  return undefined
}
