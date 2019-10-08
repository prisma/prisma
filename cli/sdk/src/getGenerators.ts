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
import { BinaryDownloadConfiguration } from '@prisma/fetch-engine/dist/download'

import { getConfig, getDMMF } from './engineCommands'
import { download } from '@prisma/fetch-engine'
import { unique } from './unique'
import { pick } from './pick'
import { Generator } from './Generator'
import { resolveOutput } from './resolveOutput'

export type GetGeneratorOptions = {
  schemaPath: string
  aliases?: { [alias: string]: string }
  version?: string
  printDownloadProgress?: boolean
  baseDir?: string // useful in tests to resolve the base dir from which `output` is resolved
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
  aliases,
  version,
  printDownloadProgress,
  baseDir = path.dirname(schemaPath),
}: GetGeneratorOptions): Promise<Generator[]> {
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`${schemaPath} does not exist`)
  }

  const schema = fs.readFileSync(schemaPath, 'utf-8')
  const dmmf = await getDMMF(schema)
  const config = await getConfig(schema)

  validateGenerators(config.generators)

  const runningGenerators: Generator[] = []
  try {
    // 1. Get all generators
    const generators = await pMap(
      config.generators,
      async (generator, index) => {
        let generatorPath = generator.provider
        if (aliases && aliases[generator.provider]) {
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
        if (generator.output) {
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
          otherGenerators: skipIndex(config.generators, index),
          schemaPath,
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
    const binaryTargets = unique(
      config.generators.flatMap(g => g.binaryTargets || []),
    )

    const binariesConfig: BinaryDownloadConfiguration = binaries.reduce(
      (acc, curr) => {
        acc[engineTypeToBinaryType(curr)] = path.join(__dirname, '../')
        return acc
      },
      {},
    )

    const downloadParams = {
      binaries: binariesConfig,
      binaryTargets: binaryTargets as any[],
      showProgress:
        typeof printDownloadProgress === 'boolean'
          ? printDownloadProgress
          : true,
      version: version || 'latest',
    }

    const binaryPaths = await download(downloadParams)

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

function validateGenerators(generators: GeneratorConfig[]) {
  for (const generator of generators) {
    if (generator.config.platforms) {
      throw new Error(
        `The \`platforms\` field on the generator definition is deprecated. Please rename it to \`binaryTargets\`.`,
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

  throw new Error(`Could not convert binary type ${engineType}`)
}
