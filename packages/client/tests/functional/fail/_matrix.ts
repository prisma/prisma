import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'sqlite',
      id: 'Int @id @default(autoincrement())',
    },
    {
      provider: 'postgresql',
      id: 'Int @id @default(autoincrement())',
    },
    {
      provider: 'mysql',
      id: 'Int @id @default(autoincrement())',
    },
    {
      provider: 'sqlserver',
      id: 'Int @id @default(autoincrement())',
    },
    {
      provider: 'cockroachdb',
      id: 'BigInt @id @default(autoincrement())',
    },
    {
      provider: 'mongodb',
      id: 'String @id @default(auto()) @map("_id") @db.ObjectId',
    },
  ],
])
