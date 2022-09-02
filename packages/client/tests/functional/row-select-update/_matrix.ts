import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'sqlite',
      providerFeatures: '',
    },
    {
      provider: 'postgresql',
      providerFeatures: '',
    },
    {
      provider: 'mysql',
      providerFeatures: '',
    },
    {
      provider: 'sqlserver',
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
