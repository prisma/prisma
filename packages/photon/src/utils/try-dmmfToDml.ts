import { dmmfToDml, getConfig, getRawDMMF } from '../engineCommands'

async function main() {
  const datamodel = `datasource db {
    provider = "sqlite"
    url      = "file:dev.db"
    default  = true
  }
  
  generator photon {
    provider  = "photonjs"
    output    = "@generated/photon"
    transpile = false
  }
  
  model User {
    id       String @id @default(uuid())
    username String
    posts    Post[]
  }
  
  model Post {
    i2d  String @id @default(uuid())
    data String
    user User?
  }`

  const config = await getConfig(datamodel)
  const dmmf = await getRawDMMF(datamodel)

  const newDatamodel = await dmmfToDml({
    config,
    dmmf: dmmf.datamodel,
  })

  console.log(newDatamodel)
}

main()
