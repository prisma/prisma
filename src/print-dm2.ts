import { LiftEngine } from './LiftEngine'
import {
  DefaultParser,
  isdlToDmmfDatamodel,
  DatabaseType,
} from 'prisma-datamodel'

const dm1 = `type User {
  id: Int @id
  name: String!
}`

async function main() {
  const engine = new LiftEngine({ projectDir: process.cwd() })
  const parser = DefaultParser.create(DatabaseType.postgres)
  const isdl = parser.parseFromSchemaString(dm1)
  const { dmmf, dataSources } = isdlToDmmfDatamodel(isdl)

  const result = await engine.convertDmmfToDml({
    dmmf: JSON.stringify(dmmf),
    dataSources,
  })
  console.log(result.datamodel)
}

main().catch(console.error)
