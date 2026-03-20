import { defineMatrix } from '../_utils/defineMatrix'
import { AdapterProviders, Providers } from '../_utils/providers'

export default defineMatrix(() => [[{ provider: Providers.POSTGRESQL, driverAdapter: AdapterProviders.JS_PG_POSTGIS }]])
