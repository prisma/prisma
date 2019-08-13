import fs from 'fs'
import { getRawDMMF } from '../engineCommands'
import { blog } from '../fixtures/blog'

async function main() {
  console.log('fetching dmmf', blog)
  const dmmf = await getRawDMMF(blog)
  // const dmmf = await getDMMF({ datamodel: blog, datamodelPath: 'datamodel file' })
  fs.writeFileSync(__dirname + '/blog-dmmf-raw.json', JSON.stringify(dmmf, null, 2))
}

main().catch(console.error)
