import { defineMatrix } from '../../../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'sqlite',
    },
    {
      provider: 'postgresql',
    },
    // {
    //   provider: 'postgresql',
    //   providerFlavor: 'js_neon',
    // },
    {
      provider: 'cockroachdb',
    },
  ],
  [],
])
