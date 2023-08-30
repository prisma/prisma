import { defineMatrix } from '../../_utils/defineMatrix'
import { ProviderFlavors } from '../../_utils/providerFlavors'
import { Providers } from '../../_utils/providers'

// relationMode: '' -> empty means default (foreignKeys)
export default defineMatrix(() => [
  [
    {
      provider: Providers.POSTGRESQL,
      relationMode: 'prisma',
    },
    {
      provider: Providers.POSTGRESQL,
      relationMode: '',
    },
    // {
    //   provider: Providers.POSTGRESQL,
    //   providerFlavor: ProviderFlavors.JS_NEON,
    //   relationMode: 'prisma',
    // },
    // {
    //   provider: Providers.POSTGRESQL,
    //   providerFlavor: ProviderFlavors.JS_NEON,
    //   relationMode: '',
    // },
    {
      provider: Providers.MYSQL,
      relationMode: 'prisma',
    },
    {
      provider: Providers.MYSQL,
      relationMode: '',
    },
    {
      provider: Providers.MYSQL,
      providerFlavor: ProviderFlavors.JS_PLANETSCALE,
      relationMode: 'prisma',
    },
    {
      provider: Providers.MYSQL,
      providerFlavor: ProviderFlavors.JS_PLANETSCALE,
      relationMode: 'prisma',
    },
  ],
])
