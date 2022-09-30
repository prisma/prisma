import { defineMatrix } from '../_utils/defineMatrix'
import { Providers } from '../_utils/providers'

const RI = process.env.RI
if (RI && RI !== 'prisma' && RI !== 'foreignKeys') {
  throw new Error(`RI must be either "prisma" or "foreignKeys" but was "${RI}"`)
}

type RIType = 'prisma' | 'foreignKeys' | ''
const referentialIntegrity: RIType = (RI as RIType) || ''

type ReferentialActions = 'DEFAULT' | 'Cascade' | 'Restrict' | 'NoAction' | 'SetNull' | 'SetDefault'

const onUpdate: ReferentialActions | string = 'DEFAULT'
const onDelete: ReferentialActions | string = 'SetNull'

// TODO: fix mysql issues with Restrict
export default defineMatrix(() => [
  [
    {
      provider: Providers.POSTGRESQL,
      id: 'String @id',
      referentialIntegrity,
      referentialActions: {
        onUpdate,
        onDelete,
      },
    },

    /*
    {
      provider: Providers.COCKROACHDB,
      id: 'String @id',
      referentialIntegrity,
      referentialActions: {
        onUpdate,
        onDelete,
      },
    },
    {
      provider: Providers.MYSQL,
      id: 'String @id',
      referentialIntegrity,
      referentialActions: {
        onUpdate,
        onDelete,
      },
    },
    {
      provider: Providers.SQLSERVER,
      id: 'String @id',
      referentialIntegrity,
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
