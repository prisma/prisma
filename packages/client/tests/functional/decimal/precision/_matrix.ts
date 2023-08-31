import { defineMatrix } from '../../_utils/defineMatrix'
import { ProviderFlavors } from '../../_utils/providerFlavors'

const maxPrecisionByProvider = {
  sqlserver: 38,
  mysql: 65,
}

export default defineMatrix(
  () => [
    [
      {
        provider: 'postgresql',
      },
      // {
      //   provider: 'postgresql',
      //   providerFlavor: 'js_neon',
      // },
      {
        provider: 'mysql',
      },
      {
        provider: 'mysql',
        providerFlavor: ProviderFlavors.VITESS_8,
      },
      {
        provider: 'mysql',
        providerFlavor: ProviderFlavors.JS_PLANETSCALE,
      },
      {
        provider: 'cockroachdb',
      },
      {
        provider: 'sqlserver',
      },
    ],
    [
      {
        precision: '10',
        scale: '0',
      },
      // TODO: fails with @prisma/planetscale
      // Property failed after 20 tests
      // { seed: 507461022, path: "19:14", endOnFailure: true }
      // Counterexample: ["4169586.4"]
      // Shrunk 1 time(s)
      // Got error: Property failed by returning false
      // Hint: Enable verbose mode in order to have the list of all failing values encountered during the run
      {
        precision: '20',
        scale: '10',
      },
      // TODO: fails with @prisma/planetscale
      // Property failed after 1 tests
      // { seed: 2118077775, path: "0:0:0", endOnFailure: true }
      // Counterexample: ["9.2"]
      // Shrunk 2 time(s)
      // Got error: Property failed by returning false
      // Hint: Enable verbose mode in order to have the list of all failing values encountered during the run
      {
        // max for sql server
        precision: '38',
        scale: '30',
      },
      // TODO: fails with @prisma/planetscale
      // Property failed after 1 tests
      // { seed: -615581445, path: "0:1:1:39:2:0", endOnFailure: true }
      // Counterexample: ["1.4"]
      // Shrunk 5 time(s)
      // Got error: Property failed by returning false
      // Hint: Enable verbose mode in order to have the list of all failing values encountered during the run
      {
        // max for mysql
        precision: '65',
        scale: '30',
      },
      {
        precision: '1000',
        scale: '500',
      },
    ],
  ],
  {
    exclude: ({ provider, precision }) => {
      const max = maxPrecisionByProvider[provider]
      if (typeof max === 'undefined') {
        return false
      }
      return Number(precision) > max
    },
  },
)
