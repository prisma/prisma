import { defineMatrix } from '../_utils/defineMatrix'
import { ProviderFlavors } from '../_utils/providerFlavors'

const mysqlProvider = {
  provider: 'mysql',
  previewFeatures: 'fullTextSearch", "fullTextIndex',
  index: `
  @@fulltext([name])
  @@fulltext([name, email])
  @@fulltext([email])
  `,
  andQuery: '+John +Smith',
  orQuery: 'John April',
  notQuery: 'John -Smith April',
  noResultsQuery: '+April +Smith',
  badQuery: 'John <--> Smith',
}

const postgresqlProvider = {
  provider: 'postgresql',
  previewFeatures: 'fullTextSearch',
  index: '',
  andQuery: 'John & Smith',
  orQuery: 'John | April',
  notQuery: '(John | April) & !Smith',
  noResultsQuery: 'April & Smith',
  badQuery: 'John Smith',
}

export default defineMatrix(() => [
  [
    postgresqlProvider,
    {
      ...postgresqlProvider,
      providerFlavor: ProviderFlavors.JS_PG,
    },
    {
      ...postgresqlProvider,
      providerFlavor: ProviderFlavors.JS_NEON,
    },
    mysqlProvider,
    {
      ...mysqlProvider,
      providerFlavor: ProviderFlavors.VITESS_8,
    },
    {
      ...mysqlProvider,
      providerFlavor: ProviderFlavors.JS_PLANETSCALE,
    },
  ],
])
