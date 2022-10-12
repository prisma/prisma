import { defineMatrix } from '../_utils/defineMatrix'
import { Providers } from '../_utils/providers'

const RelationModeEnv = process.env.RELATION_MODE
if (RelationModeEnv && RelationModeEnv !== 'prisma' && RelationModeEnv !== 'foreignKeys') {
  throw new Error(`RELATION_MODE must be either "prisma" or "foreignKeys" but was "${RelationModeEnv}"`)
}

type RelationMode = 'prisma' | 'foreignKeys' | ''
const relationMode: RelationMode = (RelationModeEnv as RelationMode) || ''

export default defineMatrix(() => [
  [
    {
      provider: Providers.MYSQL,
      relationMode,
    },
    {
      provider: Providers.POSTGRESQL,
      relationMode,
    },
  ],
  [
    {
      previewFeatures: '"referentialIntegrity"',
    },
  ],
])
