import { defineMatrix } from '../../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'postgresql',
    },
    //  TODO cockroachdb?
    // {
    //   provider: 'postgresql',
    //   providerFlavor: 'js_neon',
    // },
  ],
])
