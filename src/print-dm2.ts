import { isdlToDatamodel2 } from '@prisma/photon'
import { DatabaseType, DefaultParser } from 'prisma-datamodel'
import { LiftEngine } from './LiftEngine'

const dm1 = `type User {
  id: UUID @id
  name: String!
}`

async function main() {
  const parser = DefaultParser.create(DatabaseType.postgres)
  const isdl = parser.parseFromSchemaString(dm1)

  const datamodel = await isdlToDatamodel2(isdl, [])
  console.log(datamodel)
}

main().catch(console.error)
