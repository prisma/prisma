import { defineMatrix } from '../../_utils/defineMatrix'

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
      {
        provider: 'mysql',
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
      {
        precision: '20',
        scale: '10',
      },
      {
        // max for sql server
        precision: '38',
        scale: '30',
      },
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
