import { defineMatrix } from '../_utils/defineMatrix'
import { Providers } from '../_utils/providers'

export default defineMatrix(() => [
  [
    {
      provider: Providers.SQLITE,
      id: 'Int @id @default(autoincrement())',
      providerFeatures: '',
    },
    {
      provider: Providers.POSTGRESQL,
      id: 'Int @id @default(autoincrement())',
      providerFeatures: '',
    },
    {
      provider: Providers.MYSQL,
      id: 'Int @id @default(autoincrement())',
      providerFeatures: '',
    },
    {
      provider: Providers.SQLSERVER,
      id: 'Int @id @default(autoincrement())',
      providerFeatures: '',
    },
    {
      provider: Providers.COCKROACHDB,
      id: 'BigInt @id @default(autoincrement())',
      providerFeatures: '',
    },
    {
      provider: Providers.MONGODB,
      id: 'String @id @default(auto()) @map("_id") @db.ObjectId',
      providerFeatures: '"mongoDb", ',
    },
  ],
  [
    {
      previewFeatures: '"tracing"',
    },
    {
      previewFeatures: '"referentialIntegrity"',
    },
  ],
])
/* Each test suite gets its `TestSuiteConfig` thanks to `getTestSuiteConfigs`.
   `getTestSuiteConfigs` gives you `TestSuiteConfig[]`, the matrix cross-product.
  `_schema.ts` is then inflated with that cross-product, see example inputs below:

  [
    {
      'provider': 'sqlite',
      'id': 'Int @id @default(autoincrement())',
      'providerFeatures': '',
      'previewFeatures': '"previewFeatureFlag1"',
    },
    {
      'provider': 'mongodb',
      'id': 'String @id @default(auto()) @map("_id") @db.ObjectId',
      'providerFeatures': '"mongoDb", ',
      'previewFeatures': '"previewFeatureFlag1"',
    },
    {
      'provider': 'sqlite',
      'id': 'Int @id @default(autoincrement())',
      'providerFeatures': '',
      'previewFeatures': '"previewFeatureFlag2"',
    },
    {
      'provider': 'mongodb',
      'id': 'String @id @default(auto()) @map("_id") @db.ObjectId',
      'providerFeatures': '"mongoDb", ',
      'previewFeatures': '"previewFeatureFlag2"',
    },
  ]
*/
