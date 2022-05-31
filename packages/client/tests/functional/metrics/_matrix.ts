import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'sqlite',
    },
  ],
  [
    {
      engineType: 'library',
    },
    {
      engineType: 'binary',
    },
  ],
])
