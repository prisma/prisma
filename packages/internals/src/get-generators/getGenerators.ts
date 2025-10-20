import Debug from '@prisma/debug'
import { enginesVersion } from '@prisma/engines'
import type {
  EngineType,
  Generator as IGenerator,
  GeneratorConfig,
  GeneratorOptions,
  SqlQueryOutput,
} from '@prisma/generator'
import { bold } from 'kleur/colors'
import pMap from 'p-map'
import path from 'path'
import { match } from 'ts-pattern'

import { getDMMF, getEnvPaths, loadSchemaContext, mergeSchemas, SchemaContext } from '..'
import { Generator, InProcessGenerator, JsonRpcGenerator } from '../Generator'
import { resolveOutput } from '../resolveOutput'
import { extractPreviewFeatures } from '../utils/extractPreviewFeatures'
import { missingDatasource } from '../utils/missingDatasource'
import { missingModelMessage, missingModelMessageMongoDB } from '../utils/missingGeneratorMessage'
import { parseEnvValue } from '../utils/parseEnvValue'
import { printConfigWarnings } from '../utils/printConfigWarnings'
import { getBinaryPathsByVersion } from './utils/getBinaryPathsByVersion'

const debug = Debug('prisma:getGenerators')

type BinaryPathsOverride = {
  [P in EngineType]?: string
}

export type GeneratorRegistryEntry =
  | {
      type: 'rpc'
      generatorPath: string
      isNode?: boolean
    }
  | {
      type: 'in-process'
      generator: IGenerator
    }

export type GeneratorRegistry = Record<string, GeneratorRegistryEntry>

export type ProviderAliases = {
  [alias: string]: {
    generatorPath: string
    isNode?: boolean
  }
}

// From https://github.com/prisma/prisma/blob/eb4563aea6fb6e593ae48106a74f716ce3dc6752/packages/cli/src/Generate.ts#L167-L172
// versions are set like:
// version: enginesVersion,
// cliVersion: pkg.version,
export type GetGeneratorOptions = {
  /** @deprecated Pass a schemaContext instead. Kept for compatibility with prisma studio. */
  schemaPath?: string
  schemaContext?: SchemaContext
  registry: GeneratorRegistry
  /** @deprecated Use `registry` instead. Kept for compatibility with Prisma Studio. */
  providerAliases?: ProviderAliases
  version?: string
  printDownloadProgress?: boolean
  overrideGenerators?: GeneratorConfig[]
  skipDownload?: boolean
  binaryPathsOverride?: BinaryPathsOverride
  generatorNames?: string[]
  postinstall?: boolean
  noEngine?: boolean
  allowNoModels?: boolean
  typedSql?: SqlQueryOutput[]
  extensions?: {}
}
/**
 * Makes sure that all generators have the binaries they deserve and returns a
 * `Generator` class per generator defined in the schema.prisma file.
 * In other words, this is basically a generator factory function.
 */
export async function getGenerators(options: GetGeneratorOptions): Promise<Generator[]> {
  // A hack for backward compatibility with Prisma Studio. Remove in Prisma 7.
  if (options.registry === undefined && options.providerAliases !== undefined) {
    options.registry = Object.fromEntries(
      Object.entries(options.providerAliases).map(([name, definition]) => [
        name,
        {
          type: 'rpc',
          generatorPath: definition.generatorPath,
          isNode: definition.isNode,
        } satisfies GeneratorRegistryEntry,
      ]),
    )
  }

  const {
    schemaPath,
    registry,
    version,
    overrideGenerators,
    generatorNames = [],
    postinstall,
    noEngine,
    allowNoModels = true,
    typedSql,
  } = options
  // Fallback logic for prisma studio which still only passes a schema path
  const schemaContext =
    !options.schemaContext && schemaPath
      ? await loadSchemaContext({ schemaPathFromArg: schemaPath, ignoreEnvVarErrors: true })
      : options.schemaContext

  if (!schemaContext) {
    throw new Error(`no schema provided for getGenerators`)
  }

  if (!schemaContext.primaryDatasource) {
    throw new Error(missingDatasource)
  }

  printConfigWarnings(schemaContext.warnings)

  const previewFeatures = extractPreviewFeatures(schemaContext.generators)

  const dmmf = await getDMMF({
    datamodel: schemaContext.schemaFiles,
    previewFeatures,
  })

  if (dmmf.datamodel.models.length === 0 && !allowNoModels) {
    // MongoDB needs extras for @id: @map("_id") @db.ObjectId
    if (schemaContext.primaryDatasource.provider === 'mongodb') {
      throw new Error(missingModelMessageMongoDB)
    }

    throw new Error(missingModelMessage)
  }

  const generatorConfigs = filterGenerators(overrideGenerators || schemaContext.generators, generatorNames)

  const runningGenerators: Generator[] = []
  try {
    // 1. Get all generators
    const generators = await pMap(
      generatorConfigs,
      async (generatorConfig, index) => {
        const baseDir = path.dirname(generatorConfig.sourceFilePath ?? schemaContext.schemaRootDir)

        // as of now mostly used by studio
        const providerValue = parseEnvValue(generatorConfig.provider)

        const generatorDefinition = registry[providerValue] ?? {
          type: 'rpc',
          generatorPath: providerValue,
        }

        const generatorInstance = match(generatorDefinition)
          .with({ type: 'in-process' }, ({ generator }) => new InProcessGenerator(generatorConfig, generator))
          .with(
            { type: 'rpc' },
            ({ generatorPath, isNode }) => new JsonRpcGenerator(generatorPath, generatorConfig, isNode),
          )
          .exhaustive()

        await generatorInstance.init()

        // resolve output path
        if (generatorConfig.output) {
          generatorConfig.output = {
            value: path.resolve(baseDir, parseEnvValue(generatorConfig.output)),
            fromEnvVar: null,
          }
          generatorConfig.isCustomOutput = true
        } else {
          if (!generatorInstance.manifest?.defaultOutput) {
            throw new Error(
              `Can't resolve output dir for generator ${bold(generatorConfig.name)} with provider ${bold(
                generatorConfig.provider.value!,
              )}.
You need to define \`output\` in the generator block in the schema file.`,
            )
          }

          generatorConfig.output = {
            value: await resolveOutput({
              defaultOutput: generatorInstance.manifest.defaultOutput,
              baseDir,
            }),
            fromEnvVar: null,
          }
        }

        const datamodel = mergeSchemas({ schemas: schemaContext.schemaFiles })
        const envPaths = getEnvPaths(schemaContext.schemaPath, { cwd: generatorConfig.output.value! })

        const options: GeneratorOptions = {
          datamodel,
          datasources: schemaContext.datasources,
          generator: generatorConfig,
          dmmf,
          otherGenerators: skipIndex(generatorConfigs, index),
          schemaPath: schemaContext.schemaPath, // TODO:(schemaPath) can we get rid of schema path passing here?
          version: version || enginesVersion, // this version makes no sense anymore and should be ignored
          postinstall,
          noEngine,
          allowNoModels,
          envPaths,
          typedSql,
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

    // 2. Check, if all required generators are there.
    // Generators can say in their "requiresGenerators" property in the manifest, which other generators they depend on
    // This has mostly been introduced for 3rd party generators, which rely on `prisma-client-js`.
    const generatorProviders: string[] = generatorConfigs.map((g) => parseEnvValue(g.provider))

    for (const g of generators) {
      if (g.manifest && g.manifest.requiresGenerators && g.manifest.requiresGenerators.length > 0) {
        for (const neededGenerator of g.manifest.requiresGenerators) {
          if (!generatorProviders.includes(neededGenerator)) {
            throw new Error(
              `Generator "${g.manifest.prettyName}" requires generator "${neededGenerator}", but it is missing in your schema.prisma.
Please add it to your schema.prisma:

generator gen {
  provider = "${neededGenerator}"
}
`,
            )
          }
        }
      }
    }

    // 3. Client engine no longer requires downloading binaries
    const neededVersions = Object.create(null)

    debug('neededVersions', JSON.stringify(neededVersions, null, 2))
    // No binary downloads needed - client engine is WASM-based
    getBinaryPathsByVersion({
      neededVersions,
    })

    return generators
  } catch (e) {
    // make sure all generators that are already running are being stopped
    runningGenerators.forEach((g) => g.stop())
    throw e
  }
}

type NeededVersions = {
  [key: string]: {
    engines: EngineType[]
  }
}

export type GetBinaryPathsByVersionInput = {
  neededVersions: NeededVersions
}

/**
 * Shortcut for getGenerators, if there is only one generator defined. Useful for testing.
 * @param schemaPath path to schema.prisma
 * @param aliases Aliases like `photonjs` -> `node_modules/photonjs/gen.js`
 * @param version Version of the binary, commit hash of https://github.com/prisma/prisma-engine/commits/master
 * @param printDownloadProgress `boolean` to print download progress or not
 */
export async function getGenerator(options: GetGeneratorOptions): Promise<Generator> {
  const generators = await getGenerators(options)
  return generators[0]
}

export function skipIndex<T = any>(arr: T[], index: number): T[] {
  return [...arr.slice(0, index), ...arr.slice(index + 1)]
}

function filterGenerators(generators: GeneratorConfig[], generatorNames: string[]) {
  if (generatorNames.length < 1) {
    return generators
  }

  const filtered = generators.filter((generator) => generatorNames.includes(generator.name))

  if (filtered.length !== generatorNames.length) {
    const missings = generatorNames.filter((name) => filtered.find((generator) => generator.name === name) == null)
    const isSingular = missings.length <= 1
    throw new Error(
      `The ${isSingular ? 'generator' : 'generators'} ${bold(missings.join(', '))} specified via ${bold(
        '--generator',
      )} ${isSingular ? 'does' : 'do'} not exist in your Prisma schema`,
    )
  }

  return filtered
}
