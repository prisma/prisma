import { defineMatrix } from '../../_utils/defineMatrix'
import { allProvidersMatrix } from '../../_utils/providerFlavors'
import { builtInNames } from '../_builtInNames'

export default defineMatrix(() => [
  allProvidersMatrix,
  builtInNames.map((typeName) => ({
    typeName,
  })),
])
