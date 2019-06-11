import fs from 'fs'
import { enums } from '../fixtures/enums'
import { getDMMF } from './getDMMF'

async function main() {
  console.log('fetching dmmf')
  const dmmf = await getDMMF(enums)
  console.log({ dmmf })
  fs.writeFileSync(__dirname + '/transformed-dmmf.json', JSON.stringify(dmmf, null, 2))
}

main().catch(console.error)
