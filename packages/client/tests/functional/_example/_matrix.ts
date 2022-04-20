export default () => [
  [
    {
      '#PROVIDER#': 'sqlite',
      '#ID#': 'Int @id @default(autoincrement())',
      '#PROVIDER_FEATURES#': '',
    },
    {
      '#PROVIDER#': 'mongodb',
      '#ID#': 'String @id @default(auto()) @map("_id") @db.ObjectId',
      '#PROVIDER_FEATURES#': '"mongoDb", ',
    },
  ],
  [
    {
      '#PREVIEW_FEATURES#': '"interactiveTransactions"',
    },
    {
      '#PREVIEW_FEATURES#': '"filterJson"',
    },
  ],
]
/* Each test suite gets its `TestSuiteConfig` thanks to `getTestSuiteConfigs`.
   `getTestSuiteConfigs` gives you `TestSuiteConfig[]`, the matrix cross-product.

  [
    {
      '#PROVIDER#': 'sqlite',
      '#ID#': 'Int @id @default(autoincrement())',
      '#PROVIDER_FEATURES#': '',
      '#PREVIEW_FEATURES#': '"interactiveTransactions"',
    },
    {
      '#PROVIDER#': 'mongodb',
      '#ID#': 'String @id @default(auto()) @map("_id") @db.ObjectId',
      '#PROVIDER_FEATURES#': '"mongoDb", ',
      '#PREVIEW_FEATURES#': '"interactiveTransactions"',
    },
    {
      '#PROVIDER#': 'sqlite',
      '#ID#': 'Int @id @default(autoincrement())',
      '#PROVIDER_FEATURES#': '',
      '#PREVIEW_FEATURES#': '"filterJson"',
    },
    {
      '#PROVIDER#': 'mongodb',
      '#ID#': 'String @id @default(auto()) @map("_id") @db.ObjectId',
      '#PROVIDER_FEATURES#': '"mongoDb", ',
      '#PREVIEW_FEATURES#': '"filterJson"',
    },
  ]
*/
