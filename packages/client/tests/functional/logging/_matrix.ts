import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'sqlite',
      transactionBegin: 'BEGIN',
      transactionEnd: 'COMMIT',
    },
    {
      provider: 'postgresql',
      transactionBegin: 'BEGIN',
      transactionEnd: 'COMMIT',
    },
    {
      provider: 'mysql',
      transactionBegin: 'BEGIN',
      transactionEnd: 'COMMIT',
    },
    {
      provider: 'cockroachdb',
      transactionBegin: 'BEGIN',
      transactionEnd: 'COMMIT',
    },
    {
      provider: 'sqlserver',
      transactionBegin: 'BEGIN TRAN',
      transactionEnd: 'COMMIT',
    },
  ],
])
