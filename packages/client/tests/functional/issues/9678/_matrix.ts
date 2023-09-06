import { defineMatrix } from '../../_utils/defineMatrix'
import { allSqlProvidersMatrix } from '../../_utils/providerFlavors'
import { Providers } from '../../_utils/providers'

export default defineMatrix(() => [allSqlProvidersMatrix.filter((it) => it.provider !== Providers.SQLITE)])
