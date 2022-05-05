export default () => [
  [
    {
      provider: 'sqlite',
      id: 'Int @id @default(autoincrement())',
      foreignKeyId: 'Int?',
      providerFeatures: '',
    },
  ],
]
