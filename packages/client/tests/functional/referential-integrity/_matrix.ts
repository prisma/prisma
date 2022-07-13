import { defineMatrix } from '../_utils/defineMatrix'
import { Providers } from '../_utils/providers'

const RI = process.env.RI
if (!RI || !['prisma', 'foreignKeys'].includes(RI)) {
  throw new Error(`RI must be either "prisma" or "foreignKeys" but was "${RI}"`)
}

type RIType = 'prisma' | 'foreignKeys'
const referentialIntegrity: RIType = RI as RIType

// TODO: generate the referentialActions combinations matrix outside, and merge it to the defined matrix below
export default defineMatrix(() => [
  [
    {
      provider: Providers.POSTGRESQL,
      id: 'String @id',
      referentialIntegrity,
      referentialActions: {
        onUpdate: '',
        onDelete: '',
      },
    },
    {
      provider: Providers.POSTGRESQL,
      id: 'String @id',
      referentialIntegrity,
      referentialActions: {
        onUpdate: 'Cascade',
        onDelete: 'Cascade',
      },
    },
    {
      provider: Providers.COCKROACHDB,
      id: 'String @id',
      referentialIntegrity,
      referentialActions: {
        onUpdate: '',
        onDelete: '',
      },
    },
    {
      provider: Providers.MYSQL,
      id: 'String @id',
      referentialIntegrity,
      referentialActions: {
        onUpdate: '',
        onDelete: '',
      },
    },
    // {
    //   provider: 'sqlite',
    //   id: 'String @id',
    //   referentialIntegrity,
    // },
    // {
    //   provider: 'sqlserver',
    //   id: 'String @id',
    //   referentialIntegrity,
    // },
    // {
    //   provider: 'mongodb',
    //   id: 'String @id @map("_id")',
    //   referentialIntegrity: 'default',
    // },
  ],
  [
    {
      previewFeatures: '"referentialIntegrity"',
    },
  ],
])
