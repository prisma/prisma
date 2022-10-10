import { ProviderFlavor } from '../_matrix'

function renameDatabaseNameInURL(url: string, databaseName = 'PRISMA_DB_NAME') {
  return [...url.split('/').slice(0, -1), databaseName].join('/')
}

export function getDatabaseURL(providerFlavor: ProviderFlavor) {
  switch (providerFlavor) {
    case 'mssql':
      return renameDatabaseNameInURL(process.env.TEST_MSSQL_URI!)
    default: {
      const databaseURLKey = `TEST_FUNCTIONAL_${providerFlavor.toLocaleUpperCase()}_URI`
      const databaseURL = process.env[databaseURLKey]!
      return databaseURL
    }
  }
}
