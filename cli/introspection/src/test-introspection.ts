import { getConnectedConnectorFromCredentials } from './introspect/util'
import { DatabaseType } from 'prisma-datamodel'
import { isdlToDatamodel2 } from '@prisma/photon'

async function main() {
  const { connector, disconnect } = await getConnectedConnectorFromCredentials({
    type: DatabaseType.postgres,
    uri:
      'postgresql://prisma:qd58rcCywPRS4Stk@introspection-database-postgres.cluster-clfeqqifnebj.eu-west-1.rds.amazonaws.com:5432/random-database1',
  })

  const schemas = await connector.listSchemas()
  console.log(schemas)
  const result = await connector.introspect('public')
  console.log(result)
  const isdl = result.getDatamodel()
  console.log(isdl)
  const dmmf = await isdlToDatamodel2(isdl, [])
  console.log(dmmf)

  disconnect()
}

main()
