import { defineMatrix } from '../../_utils/defineMatrix'
import { ProviderFlavors } from '../../_utils/providerFlavors'
import { builtInNames } from '../_builtInNames'

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
      provider: 'mongodb',
    },
    {
      provider: 'cockroachdb',
    },
    {
      provider: 'sqlserver',
    },
  ],

  builtInNames.map((typeName) => ({
    typeName,
  })),
])
