import { defineMatrix } from '../../_utils/defineMatrix'

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
  [
    { fieldType: 'Int', wrongFieldType: 'Float' },
    { fieldType: 'BigInt', wrongFieldType: 'Int' },
    { fieldType: 'Float', wrongFieldType: 'Int' },
    /*{ fieldType: 'Decimal' }*/
  ],
  [
    {
      runtime: 'node',
    },
    {
      runtime: 'edge',
    },
  ],
])
