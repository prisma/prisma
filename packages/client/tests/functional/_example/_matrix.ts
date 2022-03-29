export default () => [
  [
    {
      '#PROVIDER': 'sqlite',
      '#ID': 'Int @id @default(autoincrement())',
      '#FEATURES': '',
    },
    {
      '#PROVIDER': 'mongodb',
      '#ID': 'String @id @default(auto()) @map("_id") @db.ObjectId',
      '#FEATURES': '"mongoDb", ',
    },
  ],
  [
    {
      '#EXTRA_FEATURES': '"interactiveTransactions"',
    },
    {
      '#EXTRA_FEATURES': '"filterJson"',
    },
  ],
]
/* Each test suite gets its `TestSuiteConfig` thanks to `getTestSuiteConfigs`.
   `getTestSuiteConfigs` gives you `TestSuiteConfig[]`, the matrix cross-product.

  [
    {
      '#PROVIDER': 'sqlite',
      '#ID': 'Int @id @default(autoincrement())',
      '#FEATURES': '',
      '#EXTRA_FEATURES': '"interactiveTransactions"',
    },
    {
      '#PROVIDER': 'mongodb',
      '#ID': 'String @id @default(auto()) @map("_id") @db.ObjectId',
      '#FEATURES': '"mongoDb", ',
      '#EXTRA_FEATURES': '"interactiveTransactions"',
    },
    {
      '#PROVIDER': 'sqlite',
      '#ID': 'Int @id @default(autoincrement())',
      '#FEATURES': '',
      '#EXTRA_FEATURES': '"filterJson"',
    },
    {
      '#PROVIDER': 'mongodb',
      '#ID': 'String @id @default(auto()) @map("_id") @db.ObjectId',
      '#FEATURES': '"mongoDb", ',
      '#EXTRA_FEATURES': '"filterJson"',
    },
  ]
*/
