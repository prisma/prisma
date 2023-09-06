import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'postgresql',
    },
    // {
    //   provider: 'postgresql',
    //   providerFlavor: 'js_neon',
    // },
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
