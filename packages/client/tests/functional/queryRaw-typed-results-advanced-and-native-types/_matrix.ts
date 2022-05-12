import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'postgresql',
    },
  ],
  [
    {
      previewFeatures: '',
    },
    {
      previewFeatures: '"improvedQueryRaw"',
    },
  ],
])
