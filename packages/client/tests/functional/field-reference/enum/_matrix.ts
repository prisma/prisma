import { defineMatrix } from '../../_utils/defineMatrix'
import { allProvidersMatrix } from '../../_utils/providerFlavors'
import { Providers } from '../../_utils/providers'

export default defineMatrix(() => [allProvidersMatrix.filter((it) => it.provider !== Providers.SQLITE)])
