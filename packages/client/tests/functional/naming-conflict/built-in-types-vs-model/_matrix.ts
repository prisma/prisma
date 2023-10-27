import { defineMatrix } from '../../_utils/defineMatrix'
import { allProviders } from '../../_utils/providers'
import { builtInNames } from '../_builtInNames'

export default defineMatrix(() => [
  allProviders,
  builtInNames.map((typeName) => ({
    typeName,
  })),
])
