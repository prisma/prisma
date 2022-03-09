export default () => {
  return {
    provider: [
      {
        PROVIDER: 'sqlite',
        ID: 'Int @id @default(autoincrement())',
      },
      {
        PROVIDER: 'mongodb',
        ID: 'String @id @default(auto()) @map("_id") @db.ObjectId',
      },
    ],
    previewFeatures: [
      {
        FEATURE: 'interactiveTransactions',
      },
    ],
  }
}
