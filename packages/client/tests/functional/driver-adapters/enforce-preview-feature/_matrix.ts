import { defineMatrix } from '../../_utils/defineMatrix'
import { driverAdaptersTestProviders } from '../_utils/provider'

export default defineMatrix(() => [
  driverAdaptersTestProviders,
  [
    {
      previewFeatures: '',
    },
    {
      previewFeatures: '[]',
    },
    {
      previewFeatures: '["metrics"]',
    },
    {
      previewFeatures: '["metrics", "driverAdapters"]',
    },
  ],
])
