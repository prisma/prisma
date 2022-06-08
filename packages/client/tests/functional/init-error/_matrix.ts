import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'postgresql',
      url: 'postgresql://invalid:invalid@invalid.org:123/invalid',
    },
  ],
])
