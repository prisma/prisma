import fs from 'fs'
import { optonaut } from '../fixtures/optonaut'
import { getDMMF, getRawDMMF } from './getDMMF'

async function main() {
  console.log('fetching dmmf')
  const dmmf = await getRawDMMF(optonaut)
  fs.writeFileSync(__dirname + '/optonaut-dmmf.json', JSON.stringify(dmmf, null, 2))
}

main().catch(console.error)
