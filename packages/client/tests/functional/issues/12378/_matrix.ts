import { defineMatrix } from '../../_utils/defineMatrix'
import { Providers } from '../../_utils/providers'
import { ProviderFlavors } from '../../_utils/providerFlavors'

const RelationModeEnv = process.env.RELATION_MODE
if (RelationModeEnv && RelationModeEnv !== 'prisma' && RelationModeEnv !== 'foreignKeys') {
  throw new Error(`RELATION_MODE must be either "prisma" or "foreignKeys" but was "${RelationModeEnv}"`)
}

type RelationMode = 'prisma' | 'foreignKeys' | ''
const relationMode: RelationMode = (RelationModeEnv as RelationMode) || ''

// TODO: fix mysql issues with Restrict
export default defineMatrix(() => [
  [
    {
      provider: Providers.POSTGRESQL,
      relationMode,
    },
    // {
    //   provider: Providers.POSTGRESQL,
    //   providerFlavor: ProviderFlavors.JS_NEON,
    //   relationMode,
    // },
    {
      provider: Providers.MYSQL,
      relationMode,
    },
    {
      provider: Providers.MYSQL,
      providerFlavor: ProviderFlavors.VITESS_8,
      relationMode,
    },
    {
      provider: Providers.MYSQL,
      providerFlavor: ProviderFlavors.JS_PLANETSCALE,
      relationMode,
    },
    {
      provider: Providers.COCKROACHDB,
      relationMode,
    },
    {
      provider: Providers.SQLSERVER,
      relationMode,
    },
  ],
])
