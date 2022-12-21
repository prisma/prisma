import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'sqlite',
      id: 'Int @id @default(autoincrement())',
      providerFeatures: '',
    },
    {
      provider: 'postgresql',
      id: 'Int @id @default(autoincrement())',
      providerFeatures: '',
    },
    {
      provider: 'mysql',
      id: 'Int @id @default(autoincrement())',
      providerFeatures: '',
    },
    {
      provider: 'sqlserver',
      id: 'Int @id @default(autoincrement())',
      providerFeatures: '',
    },
    {
      provider: 'cockroachdb',
      id: 'BigInt @id @default(autoincrement())',
      providerFeatures: '',
    },
    {
      provider: 'mongodb',
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
