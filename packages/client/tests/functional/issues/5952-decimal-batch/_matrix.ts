import { defineMatrix } from '../../_utils/defineMatrix'
import { allProviders } from '../../_utils/providers'

export default defineMatrix(() => [
  [
    {
      provider: 'sqlite',
    },
    {
      provider: 'postgresql',
    },
    {
      provider: 'mysql',
    },
    {
      provider: 'sqlserver',
    },
    {
      provider: 'cockroachdb',
    },
  ],
  [
    {
      decimal1: '1.2',
      decimal2: '2.4',
    },
    {
      decimal1: 1.2,
      decimal2: 2.4,
    },
  ],
])
