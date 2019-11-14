import fs from 'fs'
import pMap from 'p-map'
import path from 'path'
import {
  GeneratorOptions,
  GeneratorConfig,
  EngineType,
} from '@prisma/generator-helper'
import 'flat-map-polyfill'
import chalk from 'chalk'
import {
  BinaryDownloadConfiguration,
  DownloadOptions,
} from '@prisma/fetch-engine/dist/download'

import { getConfig, getDMMF } from './engineCommands'
import { download } from '@prisma/fetch-engine'
import { unique } from './unique'
import { pick } from './pick'
import { Generator } from './Generator'
import { resolveOutput } from './resolveOutput'
import { getPlatform } from '@prisma/get-platform'
import { printGeneratorConfig, fixPlatforms } from '@prisma/engine-core'
import {
  predefinedGeneratorResolvers,
  GeneratorPaths,
} from './predefinedGeneratorResolvers'

export type GetGeneratorOptions = {
  schemaPath: string
  providerAliases?: { [alias: string]: string }
  version?: string
  printDownloadProgress?: boolean
  baseDir?: string // useful in tests to resolve the base dir from which `output` is resolved
  overrideGenerators?: GeneratorConfig[]
  skipDownload?: boolean
}

/**
 * Makes sure that all generators have the binaries they deserve and returns a
 * `Generator` class per generator defined in the schema.prisma file.
 * In other words, this is basically a generator factory function.
 * @param schemaPath Path to schema.prisma
 * @param aliases Aliases like `photonjs` -> `node_modules/photonjs/gen.js`
 */
export async function getGenerators({
  schemaPath,
  providerAliases: aliases,
  version,
  printDownloadProgress,
  baseDir = path.dirname(schemaPath),
  overrideGenerators,
  skipDownload,
}: GetGeneratorOptions): Promise<Generator[]> {
  if (!schemaPath) {
    throw new Error(
      `schemaPath for getGenerators got invalid value ${schemaPath}`,
    )
  }

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`${schemaPath} does not exist`)
  }

  const schema = fs.readFileSync(schemaPath, 'utf-8')
  const dmmf = await getDMMF({ datamodel: schema, datamodelPath: schemaPath })
  const config = await getConfig({
    datamodel: schema,
    datamodelPath: schemaPath,
  })

  const generatorConfigs = overrideGenerators || config.generators

  await validateGenerators(generatorConfigs)

  const runningGenerators: Generator[] = []
  try {
    // 1. Get all generators
    const generators = await pMap(
      generatorConfigs,
      async (generator, index) => {
        let generatorPath = generator.provider
        let paths: GeneratorPaths | undefined
        if (predefinedGeneratorResolvers[generator.provider]) {
          paths = await predefinedGeneratorResolvers[generator.provider](
            baseDir,
            version,
          )
          generatorPath = paths.generatorPath
        } else if (aliases && aliases[generator.provider]) {
          generatorPath = aliases[generator.provider]
          if (!fs.existsSync(generatorPath)) {
            throw new Error(
              `Could not find generator executable ${
                aliases[generator.provider]
              } for generator ${generator.provider}`,
            )
          }
        }

        const generatorInstance = new Generator(generatorPath)

        await generatorInstance.init()

        // resolve output path
        if (paths) {
          generator.output = paths.outputPath
        } else if (generator.output) {
          generator.output = path.resolve(baseDir, generator.output)
        } else {
          if (
            !generatorInstance.manifest ||
            !generatorInstance.manifest.defaultOutput
          ) {
            throw new Error(
              `Can't resolve output dir for generator ${chalk.bold(
                generator.name,
              )} with provider ${chalk.bold(generator.provider)}.
The generator needs to either define the \`defaultOutput\` path in the manifest or you need to define \`output\` in the schema.prisma file.`,
            )
          }

          generator.output = await resolveOutput({
            defaultOutput: generatorInstance.manifest.defaultOutput,
            baseDir,
          })
        }

        const options: GeneratorOptions = {
          datamodel: schema,
          datasources: config.datasources,
          generator,
          dmmf,
          otherGenerators: skipIndex(generatorConfigs, index),
          schemaPath,
          version: version || 'latest',
        }

        // we set the options here a bit later after instantiating the Generator,
        // as we need the generator manifest to resolve the `output` dir
        generatorInstance.setOptions(options)

        runningGenerators.push(generatorInstance)

        return generatorInstance
      },
      {
        stopOnError: false, // needed so we can first make sure all generators are created properly, then cleaned up properly
      },
    )

    // 2. Download all binaries and binary targets needed
    const binaries = generators.flatMap(g =>
      g.manifest ? g.manifest.requiresEngines || [] : [],
    )
    const platform = await getPlatform()

    let binaryTargets = unique(
      generatorConfigs.flatMap(g => g.binaryTargets || []),
    ).map(t => (t === 'native' ? platform : t))

    if (binaryTargets.length === 0) {
      binaryTargets = [platform]
    }

    const binariesConfig: BinaryDownloadConfiguration = binaries.reduce(
      (acc, curr) => {
        acc[engineTypeToBinaryType(curr)] = path.join(__dirname, '../')
        return acc
      },
      {},
    )

    const downloadParams: DownloadOptions = {
      binaries: binariesConfig,
      binaryTargets: binaryTargets as any[],
      showProgress:
        typeof printDownloadProgress === 'boolean'
          ? printDownloadProgress
          : true,
      version: version || 'latest',
      skipDownload,
    }

    const binaryPathsWithEngineType = await download(downloadParams)
    const binaryPaths = mapKeys(
      binaryPathsWithEngineType,
      binaryTypeToEngineType,
    )

    for (const generator of generators) {
      if (generator.manifest && generator.manifest.requiresEngines) {
        const generatorBinaryPaths = pick(
          binaryPaths,
          generator.manifest.requiresEngines,
        )
        generator.setBinaryPaths(generatorBinaryPaths)
      }
    }

    return generators
  } catch (e) {
    // make sure all generators that are already running are being stopped
    runningGenerators.forEach(g => g.stop())
    throw e
  }
}

/**
 * Shortcut for getGenerators, if there is only one generator defined. Useful for testing.
 * @param schemaPath path to schema.prisma
 * @param aliases Aliases like `photonjs` -> `node_modules/photonjs/gen.js`
 * @param version Version of the binary, commit hash of https://github.com/prisma/prisma-engine/commits/master
 * @param printDownloadProgress `boolean` to print download progress or not
 */
export async function getGenerator(
  options: GetGeneratorOptions,
): Promise<Generator> {
  const generators = await getGenerators(options)
  return generators[0]
}

export function skipIndex<T = any>(arr: T[], index: number): T[] {
  return [...arr.slice(0, index), ...arr.slice(index + 1)]
}

export const knownBinaryTargets = [
  'native',
  'darwin',
  'linux-glibc-libssl1.0.1',
  'linux-glibc-libssl1.0.2',
  'linux-glibc-libssl1.1.0',
  'linux-musl-libssl1.1.0',
  'windows',
]

async function validateGenerators(generators: GeneratorConfig[]) {
  const platform = await getPlatform()

  for (const generator of generators) {
    if (generator.provider === 'nexus-prisma') {
      throw new Error(
        '`nexus-prisma` is no longer a generator. You can read more at https://pris.ly/nexus-prisma-upgrade-0.4',
      )
    }
    if (generator.config.platforms) {
      throw new Error(
        `The \`platforms\` field on the generator definition is deprecated. Please rename it to \`binaryTargets\`.`,
      )
    }
    if (generator.config.pinnedPlatform) {
      throw new Error(
        `The \`pinnedPlatform\` field on the generator definition is deprecated.
Please use the PRISMA_QUERY_ENGINE_BINARY env var instead to pin the binary target.`,
      )
    }
    if (generator.binaryTargets) {
      for (const binaryTarget of generator.binaryTargets) {
        if (!knownBinaryTargets.includes(binaryTarget)) {
          throw new Error(
            `Unknown binary target ${chalk.red(
              binaryTarget,
            )} in generator ${chalk.bold(generator.name)}.
Possible binaryTargets: ${chalk.greenBright(knownBinaryTargets.join(', '))}`,
          )
        }
      }

      const binaryTargets =
        generator.binaryTargets && generator.binaryTargets.length > 0
          ? generator.binaryTargets
          : ['native']

      const resolvedBinaryTargets = binaryTargets.map(p =>
        p === 'native' ? platform : p,
      )

      if (!resolvedBinaryTargets.includes(platform)) {
        if (generator) {
          console.log(`${chalk.yellow(
            'Warning:',
          )} Your current platform \`${chalk.bold(
            platform,
          )}\` is not included in your generator's \`binaryTargets\` configuration ${JSON.stringify(
            generator.binaryTargets,
          )}.
    To fix it, use this generator config in your ${chalk.bold('schema.prisma')}:
    ${chalk.greenBright(
      printGeneratorConfig({
        ...generator,
        binaryTargets: fixPlatforms(generator.binaryTargets as any[], platform),
      }),
    )}
    ${chalk.gray(
      `Note, that by providing \`native\`, Photon automatically resolves \`${platform}\`.
    Read more about deploying Photon: ${chalk.underline(
      'https://github.com/prisma/prisma2/blob/master/docs/core/generators/photonjs.md',
    )}`,
    )}\n`)
        } else {
          console.log(
            `${chalk.yellow('Warning')} The binaryTargets ${JSON.stringify(
              binaryTargets,
            )} don't include your local platform ${platform}, which you can also point to with \`native\`.
    In case you want to fix this, you can provide ${chalk.greenBright(
      `binaryTargets: ${JSON.stringify(['native', ...(binaryTargets || [])])}`,
    )} in the schema.prisma file.`,
          )
        }
      }
    }
  }
}

function engineTypeToBinaryType(
  engineType: EngineType,
): keyof BinaryDownloadConfiguration {
  if (engineType === 'introspectionEngine') {
    return 'introspection-engine' as any // TODO: Remove as any as soon as type added to @prisma/fetch-engine
  }

  if (engineType === 'migrationEngine') {
    return 'migration-engine'
  }

  if (engineType === 'queryEngine') {
    return 'query-engine'
  }

  throw new Error(`Could not convert engine type ${engineType}`)
}

function binaryTypeToEngineType(binaryType: string): string {
  if (binaryType === 'introspection-engine') {
    return 'introspectionEngine'
  }

  if (binaryType === 'migration-engine') {
    return 'migrationEngine'
  }

  if (binaryType === 'query-engine') {
    return 'queryEngine'
  }

  throw new Error(`Could not convert binary type ${binaryType}`)
}

function mapKeys<T extends object>(
  obj: T,
  mapper: (key: keyof T) => string,
): any {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    acc[mapper(key as keyof T)] = value
    return acc
  }, {})
}
