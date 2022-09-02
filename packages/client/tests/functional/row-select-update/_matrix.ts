import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'sqlite',
      providerFeatures: '',
    },
    {
      provider: 'postgresql',
      providerFeatures: '',
    },
    {
      provider: 'mysql',
      providerFeatures: '',
    },
    {
      provider: 'sqlserver',
      providerFeatures: '',
    },
    {
      provider: 'cockroachdb',
      providerFeatures: '',
    },
    {
      provider: 'mongodb',
      providerFeatures: '"mongoDb"',
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
      'previewFeatures': '"interactiveTransactions"',
    },
    {
      'provider': 'mongodb',
      'id': 'String @id @default(auto()) @map("_id") @db.ObjectId',
      'providerFeatures': '"mongoDb", ',
      'previewFeatures': '"interactiveTransactions"',
    },
    {
      'provider': 'sqlite',
      'id': 'Int @id @default(autoincrement())',
      'providerFeatures': '',
      'previewFeatures': '"referentialIntegrity"',
    },
    {
      'provider': 'mongodb',
      'id': 'String @id @default(auto()) @map("_id") @db.ObjectId',
      'providerFeatures': '"mongoDb", ',
      'previewFeatures': '"referentialIntegrity"',
    },
  ]
*/
