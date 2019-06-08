import fs from 'fs'
import { discourse } from '../fixtures/discourse'
import { getDMMF } from './getDMMF'

async function main() {
  console.log('fetching dmmf')
  const dmmf = await getDMMF(discourse)
  console.log({ dmmf })
  fs.writeFileSync(__dirname + '/discourse-dmmf.json', JSON.stringify(dmmf, null, 2))
}

main().catch(console.error)
