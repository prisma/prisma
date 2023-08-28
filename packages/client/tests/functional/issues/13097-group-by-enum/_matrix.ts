import { defineMatrix } from '../../_utils/defineMatrix'

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
      provider: 'mysql',
    },
    {
      provider: 'cockroachdb',
    },
    {
      provider: 'mongodb',
    },
  ],
])
