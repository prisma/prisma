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
    {
      provider: 'mysql',
    },
    {
      provider: 'cockroachdb',
    },
  ],
])
