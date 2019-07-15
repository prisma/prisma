import fs from 'fs'
import { blog } from '../fixtures/blog'
import { getDMMF, getRawDMMF } from './getDMMF'

async function main() {
  console.log('fetching dmmf', blog)
  const dmmf = await getRawDMMF(blog)
  console.log({dmmf})
  // const dmmf = await getDMMF({ datamodel: blog })
  fs.writeFileSync(__dirname + '/blog-dmmf.json', JSON.stringify(dmmf, null, 2))
}

main().catch(console.error)
