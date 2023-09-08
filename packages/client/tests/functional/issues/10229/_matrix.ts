import { defineMatrix } from '../../_utils/defineMatrix'
import { ProviderFlavors } from '../../_utils/providerFlavors'

export default defineMatrix(() => [
  [
    {
      provider: 'postgresql',
      url: '"postgresql://invalid:invalid@invalid.org:123/invalid"',
    },
    {
      provider: 'postgresql',
      providerFlavor: ProviderFlavors.PG,
      url: '"postgresql://invalid:invalid@invalid.org:123/invalid"',
    },
    {
      provider: 'postgresql',
      providerFlavor: ProviderFlavors.JS_NEON,
      url: '"postgresql://invalid:invalid@invalid.org:123/invalid"',
    },
    {
      provider: 'mysql',
      url: '"mysql://invalid:invalid@invalid:3307/invalid"',
    },
    {
      provider: 'mysql',
      providerFlavor: ProviderFlavors.VITESS_8,
      url: '"mysql://invalid:invalid@invalid:3307/invalid"',
    },
    {
      provider: 'mysql',
      providerFlavor: ProviderFlavors.JS_PLANETSCALE,
      url: '"mysql://invalid:invalid@invalid:3307/invalid"',
    },
    {
      provider: 'cockroachdb',
      url: '"postgresql://invalid:invalid@invalid.org:123/invalid"',
    },
  ],
])
