import fs from 'fs'
import { blog } from '../fixtures/blog'
import { getRawDMMF } from './getDMMF'

async function main() {
  console.log('fetching dmmf')
  const dmmf = await getRawDMMF(blog)
  console.log({ dmmf })
  fs.writeFileSync(__dirname + '/blog-raw-dmmf.json', JSON.stringify(dmmf, null, 2))
}

main().catch(console.error)
