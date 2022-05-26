import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'mysql',
      providerFeatures: '',
    },
    {
      provider: 'postgresql',
      providerFeatures: '',
    },
    {
      provider: 'mongodb',
      providerFeatures: '',
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
