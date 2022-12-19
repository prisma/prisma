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
      mapTable: 'IDENTICAL_NAMES',
    },
    {
      mapTable: 'DIFFERENT_NAMES',
    },
    {
      mapTable: false,
    },
  ],
])
