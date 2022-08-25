import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'postgresql',
    },

    {
      provider: 'sqlserver',
    },
  ],
  [
    {
      mapTable: 'true',
    },
  ],
])
