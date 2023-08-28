import { defineMatrix } from '../../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'mysql',
    },
    {
      provider: 'mysql',
      providerFlavor: 'vitess_8',
    },
    //    {
    //      provider: 'mysql',
    //      providerFlavor: 'js_planetscale',
    //    },
  ],
])
