import { defineMatrix } from '../../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'sqlite',
      foreignKeyId: 'String?',
    },
    {
      provider: 'postgresql',
      foreignKeyId: 'String?',
    },
    {
      provider: 'mysql',
      foreignKeyId: 'String?',
    },
    {
      provider: 'sqlserver',
      foreignKeyId: 'String?',
    },
    {
      provider: 'cockroachdb',
      foreignKeyId: 'String?',
    },
    {
      provider: 'mongodb',
      foreignKeyId: 'String @db.ObjectId',
    },
  ],
])
