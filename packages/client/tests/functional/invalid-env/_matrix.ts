import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'sqlite',
      id: 'Int @id @default(autoincrement())',
    },
    {
      provider: 'mongodb',
      id: 'String @id @default(auto()) @map("_id") @db.ObjectId',
    },
  ],
])
