import { defineMatrix } from '../../_utils/defineMatrix'
import { AdapterProviders, Providers } from '../../_utils/providers'

export default defineMatrix(() => [
  [
    {
      provider: Providers.SQLITE,
      adaptersForProvider: AdapterProviders.JS_D1,
    },
  ],
])
