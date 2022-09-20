import { defineMatrix } from '../../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'postgresql',
      providerFeatures: '',
    },
    {
      provider: 'mysql',
      providerFeatures: '',
    },
    {
      provider: 'cockroachdb',
      providerFeatures: '',
    },
    {
      provider: 'mongodb',
      providerFeatures: '"mongoDb"',
    },
  ],
])
