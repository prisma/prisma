import { LiftEngine } from './LiftEngine'
import path from 'path'
import { dmmf } from './example-dmmf'

async function main() {
  const engine = new LiftEngine({
    projectDir: path.join(__dirname, '../examples/blog'),
  })

  const datamodel = `model User {
  id String? @default(uuid()) @id @unique
  name String
}

source postgres 
  type = "Postgres"
  url  = "postgres://localhost:5432/prisma"
}`
  const sources = await engine.listDataSources({ datamodel })
  const dml = await engine.convertDmmfToDml({
    dmmf: JSON.stringify(dmmf),
    dataSources: sources,
  })
  console.log(dml.datamodel)
}

main().catch(console.error)
