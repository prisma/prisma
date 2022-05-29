import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'mysql',
    },
    {
      provider: 'postgresql',
    },
    {
      provider: 'mongodb',
    },
  ],
  [
    {
      previewFeatures: '"interactiveTransactions"',
    },
    {
      previewFeatures: '"filterJson"',
    },
  ],
])
