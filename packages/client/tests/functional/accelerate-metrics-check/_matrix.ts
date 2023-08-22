import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'postgresql',
      metrics: '["metrics"]',
    },
    {
      provider: 'postgresql',
      metrics: '["mEtRiCs"]',
    },
  ],
])
