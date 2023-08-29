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
    // {
    //   provider: 'postgresql',
    //   providerFlavor: 'js_neon',
    //   foreignKeyId: 'String?',
    // },
    {
      provider: 'mysql',
      foreignKeyId: 'String?',
    },
    {
      provider: 'mysql',
      providerFlavor: 'vitess_8',
      foreignKeyId: 'String?',
    },
    {
      provider: 'mysql',
      providerFlavor: 'js_planetscale',
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
