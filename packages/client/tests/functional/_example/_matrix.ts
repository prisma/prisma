import { defineMatrix } from '../_utils/defineMatrix'
import { Providers } from '../_utils/providers'

export default defineMatrix(() => [
  [
    {
      provider: Providers.SQLITE,
      id: 'Int @id @default(autoincrement())',
      randomString: 'foo',
    },
    {
      provider: Providers.POSTGRESQL,
      id: 'Int @id @default(autoincrement())',
      randomString: 'bar',
    },
    {
      provider: Providers.MYSQL,
      id: 'Int @id @default(autoincrement())',
      randomString: 'baz',
    },
    {
      provider: Providers.SQLSERVER,
      id: 'Int @id @default(autoincrement())',
      randomString: 'tele',
    },
    {
      provider: Providers.COCKROACHDB,
      id: 'BigInt @id @default(autoincrement())',
      randomString: 'phone',
    },
    {
      provider: Providers.MONGODB,
      id: 'String @id @default(auto()) @map("_id") @db.ObjectId',
      randomString: 'book',
    },
  ],
  [
    {
      previewFeatures: '"relationJoins"',
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
      'randomString': 'foo',
      'previewFeatures': '"relationJoins"',
    },
    {
      'provider': 'mongodb',
      'id': 'String @id @default(auto()) @map("_id") @db.ObjectId',
      'randomString': '"book", ',
      'previewFeatures': '"relationJoins"',
    },
    {
      'provider': 'sqlite',
      'id': 'Int @id @default(autoincrement())',
      'randomString': 'foo',
      'previewFeatures': '"referentialIntegrity"',
    },
    {
      'provider': 'mongodb',
      'id': 'String @id @default(auto()) @map("_id") @db.ObjectId',
      'randomString': '"book", ',
      'previewFeatures': '"referentialIntegrity"',
    },
    ...
  ]
*/
