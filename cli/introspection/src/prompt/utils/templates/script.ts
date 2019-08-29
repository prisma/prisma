import { getDMMF } from '@prisma/photon'
import { sortModels } from './sortModels'
import { capitalize } from '@prisma/photon/dist/runtime/utils/common'

export const minimalScript = ({ typescript }: { typescript: boolean }) => `/**
* 
* This code is a start point for you to explore the Photon API.
* Feel free to change it as much as you like or delete it altogether.
*
* Tip: Use the auto-completion of your editor to explore available API operations.
* 
*/

${getImportStatement(typescript)}
const photon = new Photon()

async function main() {
  const result = await photon. // place your cursor here, try the autocompletion
  console.log(result)
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await photon.disconnect()
  })`

const getImportStatement = es6 =>
  es6 ? `import Photon from '@generated/photon'` : `const Photon = require('@generated/photon')`

export const exampleScript = async ({ typescript, datamodel }: { typescript: boolean; datamodel: string }) => {
  const dmmf = await getDMMF({ datamodel })
  const theModel = sortModels(dmmf.datamodel.models)[0]

  if (!theModel) {
    throw new Error(`Schema must contain at least one model`)
  }

  const mapping = dmmf.mappings.find(mapping => mapping.model === theModel.name)

  if (!mapping) {
    throw new Error(`Could not find mapping for model ${theModel.name}`)
  }

  const { plural } = mapping

  return `/**
  * 
  * This code was auto-generated based on the introspection result.
  * Consider it a playground to explore the Photon API.
  * Feel free to change it as much as you like or delete it altogether.
  *
  * The model \`${theModel.name}\` was randomly selected to demonstrate some API calls.
  *
  * Tip: Use the auto-completion of your editor to explore available API operations.
  * 
  */

${getImportStatement(typescript)}
const photon = new Photon()

async function main() {
  // Tip: Explore some arguments to \`findMany\` 
  const all${capitalize(plural)} = await photon.${plural}.findMany()
  console.log(\`Retrieved all published ${plural}: \`, all${capitalize(plural)})

  // Comment out the lines below to create a new ${theModel.name}
  // ATTENTION: This code creates a new record in your database
  // const new${theModel.name} = await photon.${plural}.create({
  //   data: {
  //     // add some values here
  //   },
  // })
  // console.log(\`Created a new ${theModel.name}: \`, new${theModel.name})
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await photon.disconnect()
  })`
}
