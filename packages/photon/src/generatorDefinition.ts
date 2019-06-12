import { GeneratorDefinition, GeneratorFunction } from '@prisma/cli'
import { generateClient } from './generation/generateClient'
import { getDatamodel } from './utils/getDatamodel'

const generate: GeneratorFunction = async ({ generator, cwd }) => {
  const datamodel = await getDatamodel(cwd)
  const output = generator.output || '/node_modules/@generated/photon'
  await generateClient(datamodel, cwd, output, true)
  return ''
}

export const generatorDefinition: GeneratorDefinition = {
  prettyName: 'Photon JS Client',
  generate,
}
