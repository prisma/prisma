import { defineMatrix } from '../_utils/defineMatrix'
import { allProviders } from '../_utils/providers'
export default defineMatrix(() => [
  [
    {
      provider: 'sqlite',
    },
    {
      provider: 'postgresql',
    },
    {
      provider: 'mysql',
    },
    {
      provider: 'sqlserver',
    },
    {
      provider: 'cockroachdb',
    },
    {
      provider: 'mongodb',
    },
  ],
  [
    {
      previewFeatures: '"tracing", "interactiveTransactions"',
    },
    {
      previewFeatures: '"interactiveTransactions"',
    },
  ],
])
