import { defineMatrix } from '../_utils/defineMatrix'
import { allProviders } from '../_utils/providers'
export default defineMatrix(() => [
  allProviders,
  [
    {
      previewFeatures: '"tracing", "interactiveTransactions"',
    },
    {
      previewFeatures: '"interactiveTransactions"',
    },
  ],
])
