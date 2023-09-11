import { defineMatrix } from '../_utils/defineMatrix'
// import { ProviderFlavors } from '../_utils/providerFlavors'

export default defineMatrix(() => [
  [
    {
      provider: 'postgresql',
    },
    // Does it make sense to test them actually?
    // PG Fails with
    // Error code: P1012
    //   error: Environment variable not found: DATABASE_URI_postgresql
    // {
    //   provider: 'postgresql',
    //   providerFlavor: ProviderFlavors.JS_PG,
    // },
    // {
    //   provider: 'postgresql',
    //   providerFlavor: ProviderFlavors.JS_NEON,
    // },
  ],
])
