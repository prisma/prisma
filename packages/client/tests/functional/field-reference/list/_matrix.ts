import { defineMatrix } from '../../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'postgresql',
    },
    {
      provider: 'postgresql',
      providerFlavor: 'pg',
    },
    // {
    //   provider: 'postgresql',
    //   providerFlavor: 'js_neon',
    // },
    {
      provider: 'mongodb',
    },
    {
      provider: 'cockroachdb',
    },
  ],
])
