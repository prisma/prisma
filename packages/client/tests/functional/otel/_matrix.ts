import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'postgresql',
      id: 'Int @id @default(autoincrement())',
      providerFeatures: '',
    },
  ],
])
