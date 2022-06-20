import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'mysql',
    },
    {
      provider: 'postgresql',
    },
    {
      provider: 'sqlserver',
    },
    {
      provider: 'cockroachdb',
    },
    {
      provider: 'mongodb',
    },
  ],
])
