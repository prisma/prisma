import fs from 'fs'
import { getConfig, getDMMF } from './engineCommands'
import pMap from 'p-map'
import {
  GeneratorOptions,
  GeneratorProcess,
  GeneratorManifest,
  BinaryPaths,
} from '@prisma/generator-helper'
import { download } from '@prisma/fetch-engine'
import { unique } from './unique'
import { pick } from './pick'
import path from 'path'

/**
 * Makes sure that all generators have the binaries they deserve and returns a
 * `Generator` class per generator defined in the schema.prisma file.
 * In other words, this is basically a generator factory function.
 * @param schemaPath Path to schema.prisma
 * @param generatorAliases Aliases like `photonjs` -> `node_modules/photonjs/gen.js`
 */
export async function getGenerators(
  schemaPath: string,
  generatorAliases?: { [alias: string]: string },
  version?: string,
  printDownloadProgress?: boolean,
): Promise<Generator[]> {
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`${schemaPath} does not exist`)
  }

  const schema = fs.readFileSync(schemaPath, 'utf-8')
  const dmmf = await getDMMF(schema)
  const config = await getConfig(schema)

  const runningGenerators: Generator[] = []
  try {
    // 1. Get all generators
    const generators = await pMap(
      config.generators,
      async (generator, index) => {
        let generatorPath = generator.provider
        if (generatorAliases && generatorAliases[generator.provider]) {
          generatorPath = generatorAliases[generator.provider]
          if (!fs.existsSync(generatorPath)) {
            throw new Error(
              `Could not find generator executable ${
                generatorAliases[generator.provider]
              } for generator ${generator.provider}`,
            )
          }
        }

        const options: GeneratorOptions = {
          datamodel: schema,
          datasources: config.datasources,
          generator,
          dmmf,
          otherGenerators: skipIndex(config.generators, index),
          schemaPath,
        }

        const generatorInstance = new Generator(generatorPath, options)

        await generatorInstance.init()

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

    const binariesConfig = binaries.reduce((acc, curr) => {
      acc[curr] = path.join(__dirname, '../')
      return acc
    }, {})

    const binaryPaths = await download({
      binaries: binariesConfig,
      binaryTargets: binaryTargets as any[],
      showProgress:
        typeof printDownloadProgress === 'boolean'
          ? printDownloadProgress
          : true,
      version,
    })

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

class Generator {
  private generatorProcess: GeneratorProcess
  public manifest: GeneratorManifest | null = null
  constructor(
    private executablePath: string,
    private options: GeneratorOptions,
  ) {
    this.generatorProcess = new GeneratorProcess(this.executablePath)
  }
  async init() {
    this.manifest = await this.generatorProcess.getManifest()
  }
  stop() {
    this.generatorProcess.stop()
  }
  generate(): Promise<void> {
    return this.generatorProcess.generate(this.options)
  }
  setBinaryPaths(binaryPaths: BinaryPaths) {
    this.options.binaryPaths = binaryPaths
  }
}

export function skipIndex<T = any>(arr: T[], index: number): T[] {
  return [...arr.slice(0, index), ...arr.slice(index + 1)]
}
