import Debug from '@prisma/debug'
import { enginesVersion, getCliQueryEngineBinaryType } from '@prisma/engines'
import type { DownloadOptions } from '@prisma/fetch-engine'
import { download } from '@prisma/fetch-engine'
import type {
  BinaryTargetsEnvValue,
  EngineType,
  GeneratorConfig,
  GeneratorOptions,
  SqlQueryOutput,
} from '@prisma/generator-helper'
import type { BinaryTarget } from '@prisma/get-platform'
import { binaryTargets, getBinaryTargetForCurrentPlatform } from '@prisma/get-platform'
import { bold, gray, green, red, underline, yellow } from 'kleur/colors'
import pMap from 'p-map'
import path from 'node:path'

import {
  getConfig,
  getDMMF,
  getEnvPaths,
  type GetSchemaResult,
  getSchemaWithPath,
  mergeSchemas,
  vercelPkgPathRegex,
} from '..'
import { Generator } from '../Generator'
import { resolveOutput } from '../resolveOutput'
import { extractPreviewFeatures } from '../utils/extractPreviewFeatures'
import { missingDatasource } from '../utils/missingDatasource'
import { missingModelMessage, missingModelMessageMongoDB } from '../utils/missingGeneratorMessage'
import { parseBinaryTargetsEnvValue, parseEnvValue } from '../utils/parseEnvValue'
import { pick } from '../utils/pick'
import { printConfigWarnings } from '../utils/printConfigWarnings'
import type { GeneratorPaths } from './generatorResolvers/generatorResolvers'
import { generatorResolvers } from './generatorResolvers/generatorResolvers'
import { binaryTypeToEngineType } from './utils/binaryTypeToEngineType'
import { checkFeatureFlags } from './utils/check-feature-flags/checkFeatureFlags'
import { fixBinaryTargets } from './utils/fixBinaryTargets'
import { getBinaryPathsByVersion } from './utils/getBinaryPathsByVersion'
import { getEngineVersionForGenerator } from './utils/getEngineVersionForGenerator'
import { getOriginalBinaryTargetsValue, printGeneratorConfig } from './utils/printGeneratorConfig'

const debug = Debug('prisma:getGenerators')

export type ProviderAliases = { [alias: string]: GeneratorPaths }

type BinaryPathsOverride = {
  [P in EngineType]?: string
}

// From https://github.com/prisma/prisma/blob/eb4563aea6fb6e593ae48106a74f716ce3dc6752/packages/cli/src/Generate.ts#L167-L172
// versions are set like:
// version: enginesVersion,
// cliVersion: pkg.version,
export type GetGeneratorOptions = {
  // schemas: MultipleSchemas
  schemaPath: string
  providerAliases?: ProviderAliases
  cliVersion?: string
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
}
/**
 * Makes sure that all generators have the binaries they deserve and returns a
 * `Generator` class per generator defined in the schema.prisma file.
 * In other words, this is basically a generator factory function.
 * @param schemaPath Path to schema.prisma
 * @param aliases Aliases like `prisma-client-js` -> `node_modules/@prisma/client/generator-build/index.js`
 */
export async function getGenerators(options: GetGeneratorOptions): Promise<Generator[]> {
  const {
    schemaPath,
    providerAliases: aliases, // do you get the pun?
    version,
    cliVersion,
    printDownloadProgress,
    overrideGenerators,
    skipDownload,
    binaryPathsOverride,
    generatorNames = [],
    postinstall,
    noEngine,
    allowNoModels,
    typedSql,
  } = options

  if (!schemaPath) {
    throw new Error(`schemaPath for getGenerators got invalid value ${schemaPath}`)
  }

  let schemaResult: GetSchemaResult | null = null

  try {
    schemaResult = await getSchemaWithPath(schemaPath)
  } catch (_) {
    throw new Error(`${schemaPath} does not exist`)
  }

  const { schemas } = schemaResult
  const binaryTarget = await getBinaryTargetForCurrentPlatform()

  const queryEngineBinaryType = getCliQueryEngineBinaryType()

  const queryEngineType = binaryTypeToEngineType(queryEngineBinaryType)
  let prismaPath: string | undefined = binaryPathsOverride?.[queryEngineType]

  // overwrite query engine if the version is provided
  if (version && !prismaPath) {
    const potentialPath = eval(`require('path').join(__dirname, '..')`)
    // for pkg we need to make an exception
    if (!potentialPath.match(vercelPkgPathRegex)) {
      const downloadParams: DownloadOptions = {
        binaries: {
          [queryEngineBinaryType]: potentialPath,
        },
        binaryTargets: [binaryTarget],
        showProgress: false,
        version,
        skipDownload,
      }

      const binaryPathsWithEngineType = await download(downloadParams)
      prismaPath = binaryPathsWithEngineType[queryEngineBinaryType]![binaryTarget]
    }
  }

  const config = await getConfig({
    datamodel: schemas,
    datamodelPath: schemaPath,
    prismaPath,
    ignoreEnvVarErrors: true,
  })

  if (config.datasources.length === 0) {
    throw new Error(missingDatasource)
  }

  printConfigWarnings(config.warnings)

  const previewFeatures = extractPreviewFeatures(config)

  const dmmf = await getDMMF({
    datamodel: schemas,
    datamodelPath: schemaPath,
    prismaPath,
    previewFeatures,
  })

  if (dmmf.datamodel.models.length === 0 && !allowNoModels) {
    // MongoDB needs extras for @id: @map("_id") @db.ObjectId
    if (config.datasources.some((d) => d.provider === 'mongodb')) {
      throw new Error(missingModelMessageMongoDB)
    }

    throw new Error(missingModelMessage)
  }

  checkFeatureFlags(config, options)

  const generatorConfigs = filterGenerators(overrideGenerators || config.generators, generatorNames)

  await validateGenerators(generatorConfigs)

  const runningGenerators: Generator[] = []
  try {
    // 1. Get all generators
    const generators = await pMap(
      generatorConfigs,
      async (generator, index) => {
        let generatorPath = parseEnvValue(generator.provider)
        let paths: GeneratorPaths | undefined
        const baseDir = path.dirname(generator.sourceFilePath ?? schemaPath)

        // as of now mostly used by studio
        const providerValue = parseEnvValue(generator.provider)
        if (aliases?.[providerValue]) {
          generatorPath = aliases[providerValue].generatorPath
          paths = aliases[providerValue]
        } else if (generatorResolvers[providerValue]) {
          paths = await generatorResolvers[providerValue](baseDir, cliVersion)
          generatorPath = paths.generatorPath
        }

        const generatorInstance = new Generator(generatorPath, generator, paths?.isNode)

        await generatorInstance.init()

        // resolve output path
        if (generator.output) {
          generator.output = {
            value: path.resolve(baseDir, parseEnvValue(generator.output)),
            fromEnvVar: null,
          }
          generator.isCustomOutput = true
        } else if (paths) {
          generator.output = {
            value: paths.outputPath,
            fromEnvVar: null,
          }
        } else {
          if (!generatorInstance.manifest || !generatorInstance.manifest.defaultOutput) {
            throw new Error(
              `Can't resolve output dir for generator ${bold(generator.name)} with provider ${bold(
                generator.provider.value!,
              )}.
The generator needs to either define the \`defaultOutput\` path in the manifest or you need to define \`output\` in the datamodel.prisma file.`,
            )
          }

          generator.output = {
            value: await resolveOutput({
              defaultOutput: generatorInstance.manifest.defaultOutput,
              baseDir,
            }),
            fromEnvVar: 'null',
          }
        }

        const datamodel = mergeSchemas({ schemas })
        const envPaths = await getEnvPaths(schemaPath, { cwd: generator.output.value! })

        const options: GeneratorOptions = {
          datamodel,
          datasources: config.datasources,
          generator,
          dmmf,
          otherGenerators: skipIndex(generatorConfigs, index),
          schemaPath,
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
      if (g.manifest?.requiresGenerators && g.manifest.requiresGenerators.length > 0) {
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

    // 3. Download all binaries and binary targets needed
    const neededVersions = Object.create(null)
    for (const g of generators) {
      if (
        g.manifest?.requiresEngines &&
        Array.isArray(g.manifest.requiresEngines) &&
        g.manifest.requiresEngines.length > 0
      ) {
        const neededVersion = getEngineVersionForGenerator(g.manifest, version)
        if (!neededVersions[neededVersion]) {
          neededVersions[neededVersion] = { engines: [], binaryTargets: [] }
        }

        for (const engine of g.manifest.requiresEngines) {
          if (!neededVersions[neededVersion].engines.includes(engine)) {
            neededVersions[neededVersion].engines.push(engine)
          }
        }

        const generatorBinaryTargets = g.options?.generator?.binaryTargets

        if (generatorBinaryTargets && generatorBinaryTargets.length > 0) {
          for (const binaryTarget of generatorBinaryTargets) {
            if (!neededVersions[neededVersion].binaryTargets.find((object) => object.value === binaryTarget.value)) {
              neededVersions[neededVersion].binaryTargets.push(binaryTarget)
            }
          }
        }
      }
    }
    debug('neededVersions', JSON.stringify(neededVersions, null, 2))
    const binaryPathsByVersion = await getBinaryPathsByVersion({
      neededVersions,
      binaryTarget,
      version,
      printDownloadProgress,
      skipDownload,
      binaryPathsOverride,
    })
    for (const generator of generators) {
      if (generator.manifest?.requiresEngines) {
        const engineVersion = getEngineVersionForGenerator(generator.manifest, version)
        const binaryPaths = binaryPathsByVersion[engineVersion]
        // pick only the engines that we need for this generator
        const generatorBinaryPaths = pick(binaryPaths, generator.manifest.requiresEngines)
        debug({ generatorBinaryPaths })
        generator.setBinaryPaths(generatorBinaryPaths)

        // in case cli engine version !== client engine version
        // we need to re-generate the dmmf and pass it into the generator
        if (
          engineVersion !== version &&
          generator.options &&
          generator.manifest.requiresEngines.includes(queryEngineType) &&
          generatorBinaryPaths[queryEngineType] &&
          generatorBinaryPaths[queryEngineType]?.[binaryTarget]
        ) {
          const customDmmf = await getDMMF({
            datamodel: schemas,
            datamodelPath: schemaPath,
            prismaPath: generatorBinaryPaths[queryEngineType]?.[binaryTarget],
            previewFeatures,
          })
          const options = { ...generator.options, dmmf: customDmmf }
          debug('generator.manifest.prettyName', generator.manifest.prettyName)
          debug('options', options)
          debug('options.generator.binaryTargets', options.generator.binaryTargets)
          generator.setOptions(options)
        }
      }
    }

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
    binaryTargets: BinaryTargetsEnvValue[]
  }
}

export type GetBinaryPathsByVersionInput = {
  neededVersions: NeededVersions
  binaryTarget: BinaryTarget
  version?: string
  printDownloadProgress?: boolean
  skipDownload?: boolean
  binaryPathsOverride?: BinaryPathsOverride
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

export const knownBinaryTargets: BinaryTarget[] = [...binaryTargets, 'native']

const oldToNewBinaryTargetsMapping = {
  'linux-glibc-libssl1.0.1': 'debian-openssl-1.0.x',
  'linux-glibc-libssl1.0.2': 'debian-openssl-1.0.x',
  'linux-glibc-libssl1.1.0': 'debian-openssl1.1.x',
}

async function validateGenerators(generators: GeneratorConfig[]): Promise<void> {
  const binaryTarget = await getBinaryTargetForCurrentPlatform()

  for (const generator of generators) {
    if (generator.config.platforms) {
      throw new Error(
        'The `platforms` field on the generator definition is deprecated. Please rename it to `binaryTargets`.',
      )
    }

    if (generator.config.pinnedBinaryTargets) {
      throw new Error(
        `The \`pinnedBinaryTargets\` field on the generator definition is deprecated.
Please use the PRISMA_QUERY_ENGINE_BINARY env var instead to pin the binary target.`,
      )
    }

    if (generator.binaryTargets) {
      const binaryTargets =
        generator.binaryTargets && generator.binaryTargets.length > 0
          ? generator.binaryTargets
          : [{ fromEnvVar: null, value: 'native' }]

      const resolvedBinaryTargets: string[] = binaryTargets
        .flatMap((object) => parseBinaryTargetsEnvValue(object))
        .map((p) => (p === 'native' ? binaryTarget : p))

      for (const resolvedBinaryTarget of resolvedBinaryTargets) {
        if (oldToNewBinaryTargetsMapping[resolvedBinaryTarget]) {
          throw new Error(
            `Binary target ${red(bold(resolvedBinaryTarget))} is deprecated. Please use ${green(
              bold(oldToNewBinaryTargetsMapping[resolvedBinaryTarget]),
            )} instead.`,
          )
        }
        if (!knownBinaryTargets.includes(resolvedBinaryTarget as BinaryTarget)) {
          throw new Error(
            `Unknown binary target ${red(resolvedBinaryTarget)} in generator ${bold(generator.name)}.
Possible binaryTargets: ${green(knownBinaryTargets.join(', '))}`,
          )
        }
      }

      // Only show warning if resolvedBinaryTargets
      // is missing current platform
      if (!resolvedBinaryTargets.includes(binaryTarget)) {
        const originalBinaryTargetsConfig = getOriginalBinaryTargetsValue(generator.binaryTargets)

        console.log(`${yellow('Warning:')} Your current platform \`${bold(
          binaryTarget,
        )}\` is not included in your generator's \`binaryTargets\` configuration ${JSON.stringify(
          originalBinaryTargetsConfig,
        )}.
To fix it, use this generator config in your ${bold('schema.prisma')}:
${green(
  printGeneratorConfig({
    ...generator,
    binaryTargets: fixBinaryTargets(generator.binaryTargets, binaryTarget),
  }),
)}
${gray(
  `Note, that by providing \`native\`, Prisma Client automatically resolves \`${binaryTarget}\`.
Read more about deploying Prisma Client: ${underline(
    'https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-schema/generators',
  )}`,
)}\n`)
      }
    }
  }
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
