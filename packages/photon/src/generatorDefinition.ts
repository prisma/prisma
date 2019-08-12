import { GeneratorDefinition, GeneratorFunction } from '@prisma/cli'
import chalk from 'chalk'
import fs from 'fs'
import { promisify } from 'util'
import { generateClient } from './generation/generateClient'
import { getDatamodelPath } from './utils/getDatamodel'
// tslint:disable-next-line
const pkg = eval(`require('../package.json')`)
import Debug from 'debug'

const debug = Debug('photon:generatorDefinition')

const readFile = promisify(fs.readFile)

const defaultOutput = 'node_modules/@generated/photon'

const knownPlatforms = [
  'native',
  'darwin',
  'linux-glibc-libssl1.0.1',
  'linux-glibc-libssl1.0.2',
  'linux-glibc-libssl1.1.0',
  'linux-musl-libssl1.1.0',
]

const generate: GeneratorFunction = async ({ generator, cwd }) => {
  if (generator.platforms) {
    for (const platform of generator.platforms) {
      if (!knownPlatforms.includes(platform)) {
        throw new Error(
          `Unknown platform ${platform}. Possible platforms: ${chalk.greenBright(knownPlatforms.join(', '))}`,
        )
      }
    }
  }
  const datamodelPath = await getDatamodelPath(cwd)
  const datamodel = await readFile(datamodelPath, 'utf-8')
  const output = generator.output || defaultOutput
  const transpile =
    generator.config && typeof generator.config.transpile !== 'undefined'
      ? parseBoolean(generator.config.transpile)
      : true

  const platforms = generator.platforms && generator.platforms.length > 0 ? generator.platforms : ['native']

  const version = (pkg && pkg.prisma && pkg.prisma.version) || 'latest'
  debug({ pkg, version })

  await generateClient({
    datamodel,
    datamodelPath,
    cwd,
    outputDir: output,
    transpile,
    platforms,
    pinnedPlatform: generator.pinnedPlatform || undefined,
    generator,
    version,
  })
  return ''
}

export const generatorDefinition: GeneratorDefinition = {
  prettyName: 'Photon.js Client',
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
