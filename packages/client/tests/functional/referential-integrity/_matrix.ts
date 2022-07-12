import { defineMatrix } from '../_utils/defineMatrix'

const RI = process.env.RI
if (RI && RI !== 'prisma' && RI !== 'foreignKeys') {
  throw new Error(`RI must be either "prisma" or "foreignKeys" but was "${RI}"`)
}
type RIType = 'prisma' | 'foreignKeys' | ''

const referentialIntegrity: RIType = (RI as RIType) || ''

export default defineMatrix(() => [
  [
    {
      provider: 'postgresql',
      id: 'String @id',
      referentialIntegrity,
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
