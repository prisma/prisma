import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'postgresql',
    },
    {
      provider: 'mysql',
    },
    {
      provider: 'cockroachdb',
    },
    {
      provider: 'sqlite',
    },
    {
      provider: 'sqlserver',
    },
    {
      provider: 'mongodb',
    },
  ],
])
