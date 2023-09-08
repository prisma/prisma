import { defineMatrix } from '../_utils/defineMatrix'
import { ProviderFlavors } from '../_utils/providerFlavors'

export default defineMatrix(() => [
  [
    {
      provider: 'sqlite',
      providerFlavor: '',
      id: 'Int @id @default(autoincrement())',
      providerFeatures: '',
    },
    {
      provider: 'postgresql',
      providerFlavor: '',
      id: 'Int @id @default(autoincrement())',
      providerFeatures: '',
    },
    {
      provider: 'postgresql',
      providerFlavor: ProviderFlavors.PG,
      id: 'Int @id @default(autoincrement())',
      providerFeatures: '',
    },
    {
      provider: 'postgresql',
      providerFlavor: ProviderFlavors.JS_NEON,
      id: 'Int @id @default(autoincrement())',
      providerFeatures: '',
    },
    {
      provider: 'mysql',
      providerFlavor: '',
      id: 'Int @id @default(autoincrement())',
      providerFeatures: '',
    },
    {
      provider: 'mysql',
      providerFlavor: ProviderFlavors.VITESS_8,
      id: 'Int @id @default(autoincrement())',
      providerFeatures: '',
    },
    {
      provider: 'mysql',
      providerFlavor: ProviderFlavors.JS_PLANETSCALE,
      id: 'Int @id @default(autoincrement())',
      providerFeatures: '',
      // relationMode: 'prisma',
    },
    {
      provider: 'sqlserver',
      providerFlavor: '',
      id: 'Int @id @default(autoincrement())',
      providerFeatures: '',
    },
    {
      provider: 'cockroachdb',
      providerFlavor: '',
      id: 'BigInt @id @default(autoincrement())',
      providerFeatures: '',
    },
    {
      provider: 'mongodb',
      providerFlavor: '',
      id: 'String @id @default(auto()) @map("_id") @db.ObjectId',
      providerFeatures: '',
    },
  ],
  // [
  //   {
  //     previewFeatures: '"tracing"',
  //   },
  //   {
  //     previewFeatures: '"views"',
  //   },
  // ],
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
      'providerFeatures': '',
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
      'providerFeatures': '',
      'previewFeatures': '"previewFeatureFlag2"',
    },
  ]
*/
