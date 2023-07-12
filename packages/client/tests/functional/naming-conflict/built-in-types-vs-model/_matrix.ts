import { defineMatrix } from '../../_utils/defineMatrix'
import { builtInNames } from '../_builtInNames'

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
      provider: 'mongodb',
    },
    {
      provider: 'cockroachdb',
    },
    {
      provider: 'sqlserver',
    },
  ],

  builtInNames.map((typeName) => ({
    typeName,
  })),
])
