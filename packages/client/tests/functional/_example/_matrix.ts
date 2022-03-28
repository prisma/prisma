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
    {
      '#EXTRA_FEATURES': '"referentialIntegrity"',
    },
  ],
]
