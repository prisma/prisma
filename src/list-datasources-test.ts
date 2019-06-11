import { LiftEngine } from './LiftEngine'
import path from 'path'
import { dmmf } from './example-dmmf'
import { GeneratorConfig } from './types'

async function main() {
  const engine = new LiftEngine({
    projectDir: path.join(__dirname, '../examples/blog'),
  })

  const datamodel = `model User {
  id String? @default(uuid()) @id @unique
  name String
}

datasource postgres {
  provider = "postgres"
  url      = "postgres://localhost:5432/prisma"
  default  = true
}`
  const { datasources } = await engine.getConfig({ datamodel })
  const generators: GeneratorConfig[] = [
    {
      name: 'Photon',
      output: null,
      provider: 'javascript',
      config: {},
    },
  ]

  const dml = await engine.convertDmmfToDml({
    dmmf: JSON.stringify(dmmf),
    config: { datasources, generators },
  })
  console.log(dml.datamodel)
}

main().catch(console.error)
