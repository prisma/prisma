import { defineMatrix } from '../../_utils/defineMatrix'
import { ProviderFlavors } from '../../_utils/providerFlavors'

export default defineMatrix(() => [
  [
    {
      provider: 'postgresql',
    },
    // TODO cockroachdb?
    {
      provider: 'postgresql',
      providerFlavor: ProviderFlavors.JS_PG,
    },
    {
      provider: 'postgresql',
      providerFlavor: ProviderFlavors.JS_NEON,
    },
  ],
])
