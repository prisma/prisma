import { defineMatrix } from '../../_utils/defineMatrix'
import { builtInNames } from '../_builtInNames'

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
      provider: 'mysql',
      providerFlavor: 'vitess_8',
    },
    //    {
    //      provider: 'mysql',
    //      providerFlavor: 'js_planetscale',
    //    },
    {
      provider: 'mongodb',
    },
    {
      provider: 'cockroachdb',
    },
  ],

  builtInNames.map((enumName) => ({
    enumName,
  })),
])
