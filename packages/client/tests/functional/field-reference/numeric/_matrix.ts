import { defineMatrix } from '../../_utils/defineMatrix'
import { allProvidersMatrix } from '../../_utils/providerFlavors'

export default defineMatrix(() => [
  allProvidersMatrix,
  [
    { fieldType: 'Int', wrongFieldType: 'Float' },
    { fieldType: 'BigInt', wrongFieldType: 'Int' },
    { fieldType: 'Float', wrongFieldType: 'Int' },
    /*{ fieldType: 'Decimal' }*/
  ],
])
