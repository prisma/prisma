import { defineMatrix } from '../../_utils/defineMatrix'
import { Providers } from '../../_utils/providers'

export default defineMatrix(() => [
  [
    { provider: Providers.POSTGRESQL, driverAdapter: 'js_pg' },
    { provider: Providers.MYSQL, driverAdapter: 'js_mariadb' },
  ],
])
