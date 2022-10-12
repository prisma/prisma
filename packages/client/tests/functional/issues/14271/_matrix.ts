import { defineMatrix } from '../_utils/defineMatrix'
import { Providers } from '../_utils/providers'

const RelationModeEnv = process.env.RELATION_MODE
if (RelationModeEnv && RelationModeEnv !== 'prisma' && RelationModeEnv !== 'foreignKeys') {
  throw new Error(`RELATION_MODE must be either "prisma" or "foreignKeys" but was "${RelationModeEnv}"`)
}

type RelationMode = 'prisma' | 'foreignKeys' | ''
const relationMode: RelationMode = (RelationModeEnv as RelationMode) || ''

type ReferentialActions = 'DEFAULT' | 'Cascade' | 'Restrict' | 'NoAction' | 'SetNull' | 'SetDefault'

const onUpdate: ReferentialActions | string = 'DEFAULT'
const onDelete: ReferentialActions | string = 'SetNull'

// TODO: fix mysql issues with Restrict
export default defineMatrix(() => [
  [
    {
      provider: Providers.POSTGRESQL,
      id: 'String @id',
      relationMode,
      referentialActions: {
        onUpdate,
        onDelete,
      },
    },

    /*
    {
      provider: Providers.COCKROACHDB,
      id: 'String @id',
      relationMode,
      referentialActions: {
        onUpdate,
        onDelete,
      },
    },
    {
      provider: Providers.MYSQL,
      id: 'String @id',
      relationMode,
      referentialActions: {
        onUpdate,
        onDelete,
      },
    },
    {
      provider: Providers.SQLSERVER,
      id: 'String @id',
      relationMode,
      referentialActions: {
        onUpdate,
        onDelete,
      },
    },
    */
  ],
  [
    {
      previewFeatures: '"referentialIntegrity"',
    },
  ],
])
