import Debug from '@prisma/debug'
import {
  fixBinaryTargets,
  getOriginalBinaryTargetsValue,
  printGeneratorConfig,
} from '@prisma/engine-core'
import { enginesVersion } from '@prisma/engines'
import {
  BinaryDownloadConfiguration,
  BinaryType,
  download,
  DownloadOptions,
} from '@prisma/fetch-engine'
import {
  BinaryPaths,
  BinaryTargetsEnvValue,
  EngineType,
  GeneratorConfig,
  GeneratorManifest,
  GeneratorOptions,
} from '@prisma/generator-helper'
import { getPlatform, Platform } from '@prisma/get-platform'
import chalk from 'chalk'
import fs from 'fs'
import makeDir from 'make-dir'
import pMap from 'p-map'
import path from 'path'
import { getConfig, getDMMF } from '.'
import { Generator } from './Generator'
import { engineVersions } from './getAllVersions'
import { pick } from './pick'
import {
  GeneratorPaths,
  predefinedGeneratorResolvers,
} from './predefinedGeneratorResolvers'
import { resolveOutput } from './resolveOutput'
import { extractPreviewFeatures } from './utils/extractPreviewFeatures'
import { mapPreviewFeatures } from './utils/mapPreviewFeatures'
import { missingDatasource } from './utils/missingDatasource'
import {
  missingModelMessage,
  missingModelMessageMongoDB,
} from './utils/missingGeneratorMessage'
import { mongoFeatureFlagMissingMessage } from './utils/mongoFeatureFlagMissingMessage'
import {
  parseBinaryTargetsEnvValue,
  parseEnvValue,
} from './utils/parseEnvValue'
import { printConfigWarnings } from './utils/printConfigWarnings'

const debug = Debug('prisma:getGenerators')

export type ProviderAliases = { [alias: string]: GeneratorPaths }

type BinaryPathsOverride = {
  [P in EngineType]?: string
}

export type GetGeneratorOptions = {
  schemaPath: string
  providerAliases?: ProviderAliases
  cliVersion?: string
  version?: string
  printDownloadProgress?: boolean
  baseDir?: string // useful in tests to resolve the base dir from which `output` is resolved
  overrideGenerators?: GeneratorConfig[]
  skipDownload?: boolean
  binaryPathsOverride?: BinaryPathsOverride
}
/**
 * Makes sure that all generators have the binaries they deserve and returns a
 * `Generator` class per generator defined in the schema.prisma file.
 * In other words, this is basically a generator factory function.
 * @param schemaPath Path to schema.prisma
 * @param aliases Aliases like `prisma-client-js` -> `node_modules/@prisma/client/generator-build/index.js`
 */
export async function getGenerators({
  schemaPath,
  providerAliases: aliases, // do you get the pun?
  version,
  cliVersion,
  printDownloadProgress,
  baseDir = path.dirname(schemaPath),
  overrideGenerators,
  skipDownload,
  binaryPathsOverride,
}: GetGeneratorOptions): Promise<Generator[]> {
  if (!schemaPath) {
    throw new Error(
      `schemaPath for getGenerators got invalid value ${schemaPath}`,
    )
  }

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`${schemaPath} does not exist`)
  }
  const platform = await getPlatform()

  const queryEngineBinaryType =
    process.env.PRISMA_FORCE_NAPI === 'true'
      ? BinaryType.libqueryEngine
      : BinaryType.queryEngine

  const queryEngineType = binaryTypeToEngineType(queryEngineBinaryType)
  let prismaPath: string | undefined = binaryPathsOverride?.[queryEngineType]

  // overwrite query engine if the version is provided
  if (version && !prismaPath) {
    const potentialPath = eval(`require('path').join(__dirname, '..')`)
    // for pkg we need to make an exception
    if (!potentialPath.startsWith('/snapshot/')) {
      const downloadParams: DownloadOptions = {
        binaries: {
          [queryEngineBinaryType]: potentialPath,
        },
        binaryTargets: [platform],
        showProgress: false,
        version,
        skipDownload,
      }

      const binaryPathsWithEngineType = await download(downloadParams)
      prismaPath = binaryPathsWithEngineType[queryEngineBinaryType]![platform]
    }
  }

  const datamodel = fs.readFileSync(schemaPath, 'utf-8')

  const config = await getConfig({
    datamodel,
    datamodelPath: schemaPath,
    prismaPath,
    ignoreEnvVarErrors: true,
  })

  if (config.datasources.length === 0) {
    throw new Error(missingDatasource)
  }

  printConfigWarnings(config.warnings)

  // TODO: This needs a better abstraction, but we don't have any better right now
  const previewFeatures = mapPreviewFeatures(extractPreviewFeatures(config))

  const dmmf = await getDMMF({
    datamodel,
    datamodelPath: schemaPath,
    prismaPath,
    previewFeatures,
  })

  if (dmmf.datamodel.models.length === 0) {
// MongoDB needs extras for @id: @map("_id") @db.ObjectId
    if (config.datasources.some((d) => d.provider.includes('mongodb'))) {
      throw new Error(missingModelMessageMongoDB)
    }

    throw new Error(missingModelMessage)
  }

  if (
    config.datasources.some((d) => d.provider.includes('mongodb')) &&
    !previewFeatures.includes('mongoDb')
  ) {
    throw new Error(mongoFeatureFlagMissingMessage)
  }

  const generatorConfigs = overrideGenerators || config.generators

  await validateGenerators(generatorConfigs)

  const runningGenerators: Generator[] = []
  try {
    // 1. Get all generators
    const generators = await pMap(
      generatorConfigs,
      async (generator, index) => {
        let generatorPath = parseEnvValue(generator.provider)
        let paths: GeneratorPaths | undefined

        // as of now mostly used by studio
        const providerValue = parseEnvValue(generator.provider)
        if (aliases && aliases[providerValue]) {
          generatorPath = aliases[providerValue].generatorPath
          paths = aliases[providerValue]
        } else if (predefinedGeneratorResolvers[providerValue]) {
          paths = await predefinedGeneratorResolvers[providerValue](
            baseDir,
            cliVersion,
          )
          generatorPath = paths.generatorPath
        }

        const generatorInstance = new Generator(
          generatorPath,
          generator,
          paths?.isNode,
        )

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
          if (
            !generatorInstance.manifest ||
            !generatorInstance.manifest.defaultOutput
          ) {
            throw new Error(
              `Can't resolve output dir for generator ${chalk.bold(
                generator.name,
              )} with provider ${chalk.bold(generator.provider)}.
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

        const options: GeneratorOptions = {
          datamodel,
          datasources: config.datasources,
          generator,
          dmmf,
          otherGenerators: skipIndex(generatorConfigs, index),
          schemaPath,
          version: version || enginesVersion, // this version makes no sense anymore and should be ignored
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
    const generatorProviders: string[] = generatorConfigs.map((g) =>
      parseEnvValue(g.provider),
    )

    for (const g of generators) {
      if (
        g?.manifest?.requiresGenerators &&
        g?.manifest?.requiresGenerators.length > 0
      ) {
        for (const neededGenerator of g?.manifest?.requiresGenerators) {
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
        Array.isArray(g.manifest?.requiresEngines) &&
        g.manifest.requiresEngines.length > 0
      ) {
        const neededVersion = getEngineVersionForGenerator(g.manifest, version)
        if (!neededVersions[neededVersion]) {
          neededVersions[neededVersion] = { engines: [], binaryTargets: [] }
        }

        for (const engine of g.manifest?.requiresEngines) {
          if (!neededVersions[neededVersion].engines.includes(engine)) {
            neededVersions[neededVersion].engines.push(engine)
          }
        }

        const generatorBinaryTargets = g.options?.generator?.binaryTargets

        if (generatorBinaryTargets && generatorBinaryTargets.length > 0) {
          const binaryTarget0 = generatorBinaryTargets[0]
          // If set from env var, there is only one item
          // and we need to read the env var
          if (binaryTarget0.fromEnvVar !== null) {
            const parsedBinaryTargetsEnvValue =
              parseBinaryTargetsEnvValue(binaryTarget0)

            // remove item and replace with parsed values
            // value is an array
            // so we create one new iteam for each element in the array
            generatorBinaryTargets.shift()

            if (Array.isArray(parsedBinaryTargetsEnvValue)) {
              for (const platformName of parsedBinaryTargetsEnvValue) {
                generatorBinaryTargets.push({
                  fromEnvVar: binaryTarget0.fromEnvVar,
                  value: platformName,
                })
              }
            } else {
              generatorBinaryTargets.push({
                fromEnvVar: binaryTarget0.fromEnvVar,
                value: parsedBinaryTargetsEnvValue,
              })
            }
          }

          for (const binaryTarget of generatorBinaryTargets) {
            if (binaryTarget.value === 'native') {
              binaryTarget.value = platform
            }

            if (
              !neededVersions[neededVersion].binaryTargets.find(
                (object) => object.value === binaryTarget.value,
              )
            ) {
              neededVersions[neededVersion].binaryTargets.push(binaryTarget)
            }
          }
        }
      }
    }
    debug('neededVersions', JSON.stringify(neededVersions, null, 2))
    const binaryPathsByVersion = await getBinaryPathsByVersion({
      neededVersions,
      platform,
      version,
      printDownloadProgress,
      skipDownload,
      binaryPathsOverride,
    })
    for (const generator of generators) {
      if (generator.manifest && generator.manifest.requiresEngines) {
        const engineVersion = getEngineVersionForGenerator(
          generator.manifest,
          version,
        )
        const binaryPaths = binaryPathsByVersion[engineVersion]
        // pick only the engines that we need for this generator
        const generatorBinaryPaths = pick(
          binaryPaths,
          generator.manifest.requiresEngines,
        )
        debug({ generatorBinaryPaths })
        generator.setBinaryPaths(generatorBinaryPaths)

        // in case cli engine version !== client engine version
        // we need to re-generate the dmmf and pass it in to the generator
        if (
          engineVersion !== version &&
          generator.options &&
          generator.manifest.requiresEngines.includes(queryEngineType) &&
          generatorBinaryPaths[queryEngineType] &&
          generatorBinaryPaths[queryEngineType]?.[platform]
        ) {
          const customDmmf = await getDMMF({
            datamodel,
            datamodelPath: schemaPath,
            prismaPath: generatorBinaryPaths[queryEngineType]?.[platform],
            previewFeatures,
          })
          const options = { ...generator.options, dmmf: customDmmf }
          debug('generator.manifest.prettyName', generator.manifest.prettyName)
          debug('options', options)
          debug(
            'options.generator.binaryTargets',
            options.generator.binaryTargets,
          )
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

type GetBinaryPathsByVersionInput = {
  neededVersions: NeededVersions
  platform: Platform
  version?: string
  printDownloadProgress?: boolean
  skipDownload?: boolean
  binaryPathsOverride?: BinaryPathsOverride
}

async function getBinaryPathsByVersion({
  neededVersions,
  platform,
  version,
  printDownloadProgress,
  skipDownload,
  binaryPathsOverride,
}: GetBinaryPathsByVersionInput): Promise<Record<string, BinaryPaths>> {
  const binaryPathsByVersion: Record<string, BinaryPaths> = Object.create(null)

  // make sure, that at least the current platform is being fetched
  for (const currentVersion in neededVersions) {
    binaryPathsByVersion[currentVersion] = {}

    // ensure binaryTargets are set correctly
    const neededVersion = neededVersions[currentVersion]

    if (neededVersion.binaryTargets.length === 0) {
      neededVersion.binaryTargets = [{ fromEnvVar: null, value: platform }]
    }

    if (
      process.env.NETLIFY &&
      !neededVersion.binaryTargets.find(
        (object) => object.value === 'rhel-openssl-1.0.x',
      )
    ) {
      neededVersion.binaryTargets.push({
        fromEnvVar: null,
        value: 'rhel-openssl-1.0.x',
      })
    }

    // download
    let binaryTargetBaseDir = eval(`require('path').join(__dirname, '..')`)

    if (version !== currentVersion) {
      binaryTargetBaseDir = path.join(
        binaryTargetBaseDir,
        `./engines/${currentVersion}/`,
      )
      await makeDir(binaryTargetBaseDir).catch((e) => console.error(e))
    }

    const binariesConfig: BinaryDownloadConfiguration =
      neededVersion.engines.reduce((acc, curr) => {
        // only download the binary, of not already covered by the `binaryPathsOverride`
        if (!binaryPathsOverride?.[curr]) {
          acc[engineTypeToBinaryType(curr)] = binaryTargetBaseDir
        }
        return acc
      }, Object.create(null))

    if (Object.values(binariesConfig).length > 0) {
      // Convert BinaryTargetsEnvValue[] to Platform[]
      const platforms: Platform[] = neededVersion.binaryTargets.map(
        (binaryTarget: BinaryTargetsEnvValue) => binaryTarget.value as Platform,
      )

      const downloadParams: DownloadOptions = {
        binaries: binariesConfig,
        binaryTargets: platforms,
        showProgress:
          typeof printDownloadProgress === 'boolean'
            ? printDownloadProgress
            : true,
        version:
          currentVersion && currentVersion !== 'latest'
            ? currentVersion
            : enginesVersion,
        skipDownload,
      }

      const binaryPathsWithEngineType = await download(downloadParams)
      const binaryPaths: BinaryPaths = mapKeys(
        binaryPathsWithEngineType,
        binaryTypeToEngineType,
      )
      binaryPathsByVersion[currentVersion] = binaryPaths
    }

    if (binaryPathsOverride) {
      const overrideEngines = Object.keys(binaryPathsOverride)
      const enginesCoveredByOverride = neededVersion.engines.filter((engine) =>
        overrideEngines.includes(engine),
      )
      if (enginesCoveredByOverride.length > 0) {
        for (const engine of enginesCoveredByOverride) {
          const enginePath = binaryPathsOverride[engine]!
          binaryPathsByVersion[currentVersion][engine] = {
            [platform]: enginePath,
          }
        }
      }
    }
  }

  return binaryPathsByVersion
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

export const knownBinaryTargets: Platform[] = [
  'native',
  'darwin',
  'darwin-arm64',
  'debian-openssl-1.0.x',
  'debian-openssl-1.1.x',
  'linux-arm-openssl-1.0.x',
  'linux-arm-openssl-1.1.x',
  'rhel-openssl-1.0.x',
  'rhel-openssl-1.1.x',
  'linux-musl',
  'linux-nixos',
  'windows',
  'freebsd11',
  'freebsd12',
  'openbsd',
  'netbsd',
  'arm',
]

const oldToNewBinaryTargetsMapping = {
  'linux-glibc-libssl1.0.1': 'debian-openssl-1.0.x',
  'linux-glibc-libssl1.0.2': 'debian-openssl-1.0.x',
  'linux-glibc-libssl1.1.0': 'debian-openssl1.1.x',
}

async function validateGenerators(
  generators: GeneratorConfig[],
): Promise<void> {
  const platform = await getPlatform()

  for (const generator of generators) {
    if (parseEnvValue(generator.provider) === 'photonjs') {
      throw new Error(`Oops! Photon has been renamed to Prisma Client. Please make the following adjustments:
  1. Rename ${chalk.red('provider = "photonjs"')} to ${chalk.green(
        'provider = "prisma-client-js"',
      )} in your ${chalk.bold('schema.prisma')} file.
  2. Replace your ${chalk.bold('package.json')}'s ${chalk.red(
        '@prisma/photon',
      )} dependency to ${chalk.green('@prisma/client')}
  3. Replace ${chalk.red(
    "import { Photon } from '@prisma/photon'",
  )} with ${chalk.green(
        "import { PrismaClient } from '@prisma/client'",
      )} in your code.
  4. Run ${chalk.green('prisma generate')} again.
      `)
    }

    if (generator.config.platforms) {
      throw new Error(
        `The \`platforms\` field on the generator definition is deprecated. Please rename it to \`binaryTargets\`.`,
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
        .map((p) => (p === 'native' ? platform : p))

      for (const resolvedBinaryTarget of resolvedBinaryTargets) {
        if (oldToNewBinaryTargetsMapping[resolvedBinaryTarget]) {
          throw new Error(
            `Binary target ${chalk.red.bold(
              resolvedBinaryTarget,
            )} is deprecated. Please use ${chalk.green.bold(
              oldToNewBinaryTargetsMapping[resolvedBinaryTarget],
            )} instead.`,
          )
        }
        if (!knownBinaryTargets.includes(resolvedBinaryTarget as Platform)) {
          throw new Error(
            `Unknown binary target ${chalk.red(
              resolvedBinaryTarget,
            )} in generator ${chalk.bold(generator.name)}.
Possible binaryTargets: ${chalk.greenBright(knownBinaryTargets.join(', '))}`,
          )
        }
      }

      // Only show warning if resolvedBinaryTargets
      // is missing current platform
      if (!resolvedBinaryTargets.includes(platform)) {
        const originalBinaryTargetsConfig = getOriginalBinaryTargetsValue(
          generator.binaryTargets,
        )

        if (generator) {
          console.log(`${chalk.yellow(
            'Warning:',
          )} Your current platform \`${chalk.bold(
            platform,
          )}\` is not included in your generator's \`binaryTargets\` configuration ${JSON.stringify(
            originalBinaryTargetsConfig,
          )}.
    To fix it, use this generator config in your ${chalk.bold('schema.prisma')}:
    ${chalk.greenBright(
      printGeneratorConfig({
        ...generator,
        binaryTargets: fixBinaryTargets(generator.binaryTargets, platform),
      }),
    )}
    ${chalk.gray(
      `Note, that by providing \`native\`, Prisma Client automatically resolves \`${platform}\`.
    Read more about deploying Prisma Client: ${chalk.underline(
      'https://github.com/prisma/prisma/blob/master/docs/core/generators/prisma-client-js.md',
    )}`,
    )}\n`)
        } else {
          console.log(
            `${chalk.yellow('Warning')} The binaryTargets ${JSON.stringify(
              originalBinaryTargetsConfig,
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

function engineTypeToBinaryType(engineType: EngineType): BinaryType {
  if (engineType === 'introspectionEngine') {
    return BinaryType.introspectionEngine
  }

  if (engineType === 'migrationEngine') {
    return BinaryType.migrationEngine
  }

  if (engineType === 'queryEngine') {
    return BinaryType.queryEngine
  }
  if (engineType === 'libqueryEngine') {
    return BinaryType.libqueryEngine
  }
  if (engineType === 'prismaFmt') {
    return BinaryType.prismaFmt
  }

  throw new Error(`Could not convert engine type ${engineType}`)
}

function binaryTypeToEngineType(binaryType: string): EngineType {
  if (binaryType === BinaryType.introspectionEngine) {
    return 'introspectionEngine'
  }

  if (binaryType === BinaryType.migrationEngine) {
    return 'migrationEngine'
  }
  if (binaryType === BinaryType.libqueryEngine) {
    return 'libqueryEngine'
  }
  if (binaryType === BinaryType.queryEngine) {
    return 'queryEngine'
  }

  if (binaryType === BinaryType.prismaFmt) {
    return 'prismaFmt'
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

function getEngineVersionForGenerator(
  manifest?: GeneratorManifest,
  defaultVersion?: string | undefined,
): string {
  let neededVersion: string = manifest!.requiresEngineVersion!
  if (manifest?.version && engineVersions[manifest?.version]) {
    neededVersion = engineVersions[manifest?.version]
  }
  neededVersion = neededVersion ?? defaultVersion // default to CLI version otherwise, if not provided
  return neededVersion ?? 'latest'
}
