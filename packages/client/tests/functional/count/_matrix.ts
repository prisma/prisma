export default () => [
  [
    {
      provider: 'sqlite',
      id: 'Int @id @default(autoincrement())',
      foreignKeyId: 'Int?',
      providerFeatures: '',
    },
    {
      provider: 'postgresql',
      id: 'Int @id @default(autoincrement())',
      foreignKeyId: 'Int?',
      providerFeatures: '',
    },
    {
      provider: 'mysql',
      id: 'Int @id @default(autoincrement())',
      foreignKeyId: 'Int?',
      providerFeatures: '',
    },
    {
      provider: 'mongodb',
      id: 'String @id @default(auto()) @map("_id") @db.ObjectId',
      foreignKeyId: 'String @db.ObjectId',
      providerFeatures: '',
    },
  ],
]
