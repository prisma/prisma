import { defineMatrix } from '../_utils/defineMatrix'

const RI = process.env.RI
if (RI && RI !== 'prisma' && RI !== 'foreignKeys') {
  throw new Error(`RI must be either "prisma" or "foreignKeys" but was "${RI}"`)
}
type RIType = 'prisma' | 'foreignKeys' | ''

const referentialIntegrity: RIType = (RI as RIType) || ''

// TODO: generate the referentialActions combinations matrix outside, and merge it to the defined matrix below
export default defineMatrix(() => [
  [
    {
      provider: 'postgresql',
      id: 'String @id',
      referentialIntegrity,
      referentialActions: {
        onUpdate: '',
        onDelete: '',
      }
    },
    {
      provider: 'postgresql',
      id: 'String @id',
      referentialIntegrity,
      referentialActions: {
        onUpdate: 'Cascade',
        onDelete: 'Cascade',
      }
    },
    // {
    //   provider: 'sqlite',
    //   id: 'String @id',
    //   referentialIntegrity,
    // },
    // {
    //   provider: 'mysql',
    //   id: 'String @id',
    //   referentialIntegrity,
    // },
    // {
    //   provider: 'sqlserver',
    //   id: 'String @id',
    //   referentialIntegrity,
    // },
    // {
    //   provider: 'cockroachdb',
    //   id: 'String @id',
    //   referentialIntegrity,
    // },
    // {
    //   provider: 'mongodb',
    //   id: 'String @id @map("_id") @db.ObjectId',
    //   referentialIntegrity: 'default',
    // },
  ],
  [
    {
      previewFeatures: '"referentialIntegrity"',
    },
  ],
])
