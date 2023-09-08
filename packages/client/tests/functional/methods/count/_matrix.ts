import { defineMatrix } from '../../_utils/defineMatrix'
import { ProviderFlavors } from '../../_utils/providerFlavors'

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
      provider: 'postgresql',
      providerFlavor: 'pg',
      foreignKeyId: 'String?',
    },
    {
      provider: 'postgresql',
      providerFlavor: 'js_neon',
      foreignKeyId: 'String?',
    },
    {
      provider: 'mysql',
      foreignKeyId: 'String?',
    },
    {
      provider: 'mysql',
      providerFlavor: ProviderFlavors.VITESS_8,
      foreignKeyId: 'String?',
    },
    {
      provider: 'mysql',
      providerFlavor: ProviderFlavors.JS_PLANETSCALE,
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
