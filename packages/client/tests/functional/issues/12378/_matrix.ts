import { defineMatrix } from '../../_utils/defineMatrix'
import { allSqlProvidersMatrix } from '../../_utils/providerFlavors'
import { Providers } from '../../_utils/providers'

const RelationModeEnv = process.env.RELATION_MODE
if (RelationModeEnv && RelationModeEnv !== 'prisma' && RelationModeEnv !== 'foreignKeys') {
  throw new Error(`RELATION_MODE must be either "prisma" or "foreignKeys" but was "${RelationModeEnv}"`)
}

type RelationMode = 'prisma' | 'foreignKeys' | ''
const relationMode: RelationMode = (RelationModeEnv as RelationMode) || ''

// TODO: fix mysql issues with Restrict
export default defineMatrix(() => [
  allSqlProvidersMatrix.filter((it) => it.provider !== Providers.SQLITE).map((it) => ({ ...it, relationMode })),
])
