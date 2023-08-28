import { defineMatrix } from '../../../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'sqlite',
    },
    {
      provider: 'mongodb',
    },
    {
      provider: 'sqlserver',
    },
    {
      provider: 'postgresql',
    },
    // {
    //   provider: 'postgresql',
    //   providerFlavor: 'js_neon',
    // },
    {
      provider: 'mysql',
    },
    {
      provider: 'cockroachdb',
    },
  ],
])
