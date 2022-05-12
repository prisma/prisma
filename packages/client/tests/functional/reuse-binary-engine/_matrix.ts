import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'sqlite',
      id: 'Int @id @default(autoincrement())',
      providerFeatures: '',
    },
  ],
  [],
])
