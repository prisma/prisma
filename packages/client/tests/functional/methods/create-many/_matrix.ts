import { defineMatrix } from '../../_utils/defineMatrix'
import { ProviderFlavors } from '../../_utils/providerFlavors'

export default defineMatrix(() => [
  [
    {
      provider: 'mysql',
    },
    {
      provider: 'mysql',
      providerFlavor: ProviderFlavors.VITESS_8,
    },
    {
      provider: 'mysql',
      providerFlavor: ProviderFlavors.JS_PLANETSCALE,
    },
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
    {
      provider: 'cockroachdb',
    },
    {
      provider: 'mongodb',
    },
  ],
])
