import { GeneratorDefinition, GeneratorFunction } from '@prisma/cli'
import { generateClient } from './generation/generateClient'
import { getDatamodel } from './utils/getDatamodel'

const defaultOutput = 'node_modules/@generated/photon'

const generate: GeneratorFunction = async ({ generator, cwd }) => {
  const datamodel = await getDatamodel(cwd)
  const output = generator.output || defaultOutput
  const transpile =
    generator.config && typeof generator.config.transpile !== 'undefined'
      ? parseBoolean(generator.config.transpile)
      : true
  await generateClient({ datamodel, cwd, outputDir: output, transpile })
  return ''
}

export const generatorDefinition: GeneratorDefinition = {
  prettyName: 'Photon JS Client',
  generate,
  defaultOutput,
}

function parseBoolean(value: any): boolean {
  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  return Boolean(value)
}
