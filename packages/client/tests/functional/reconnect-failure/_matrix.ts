import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    { provider: 'postgresql' },
    { provider: 'mysql' },
    { provider: 'sqlserver' },
    { provider: 'sqlite' },
    { provider: 'cockroachdb' },
  ],
])
