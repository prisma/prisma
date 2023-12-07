import { defineMatrix } from '../../_utils/defineMatrix'
import { allProviders } from '../../_utils/providers'

export default defineMatrix(() => [
  allProviders,
  [
    { fieldType: 'Int', wrongFieldType: 'Float' },
    { fieldType: 'BigInt', wrongFieldType: 'Int' },
    { fieldType: 'Float', wrongFieldType: 'Int' },
    /*{ fieldType: 'Decimal' }*/
  ],
])
