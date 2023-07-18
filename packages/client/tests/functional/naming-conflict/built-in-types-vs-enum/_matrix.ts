import { defineMatrix } from '../../_utils/defineMatrix'
import { builtInNames } from '../_builtInNames'

export default defineMatrix(() => [
  [
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
  ],

  builtInNames.map((enumName) => ({
    enumName,
  })),
])
