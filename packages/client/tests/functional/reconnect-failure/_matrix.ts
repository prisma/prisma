import { defineMatrix } from '../_utils/defineMatrix'
import { allSqlProvidersMatrix, ProviderFlavors } from '../_utils/providerFlavors'

export default defineMatrix(() => [
  allSqlProvidersMatrix.filter(
    // Skipped because, at the moment there is always a database available
    // because the random database id is not used
    (it) => it.providerFlavor !== ProviderFlavors.VITESS_8 && it.providerFlavor !== ProviderFlavors.JS_PLANETSCALE,
  ),
])
