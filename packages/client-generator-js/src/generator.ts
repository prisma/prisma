import path from 'node:path'

import Debug from '@prisma/debug'
import { enginesVersion } from '@prisma/engines-version'
import { EngineType, Generator, GeneratorConfig, GeneratorManifest, GeneratorOptions } from '@prisma/generator'
import { ClientEngineType, getClientEngineType, parseEnvValue } from '@prisma/internals'
import { yellow } from 'kleur/colors'
import { match } from 'ts-pattern'

import { version as clientVersion } from '../package.json'
import { generateClient } from './generateClient'
import { resolvePrismaClient } from './resolvePrismaClient'

const debug = Debug('prisma:client:generator')

type PrismaClientJsGeneratorOptions = {
  shouldResolvePrismaClient?: boolean
  runtimePath?: string
}

const MISSING_CUSTOM_OUTPUT_PATH_WARNING = `\
${yellow('Warning:')} You did not specify an output path for your \`generator\` in schema.prisma. \
This behavior is deprecated and will no longer be supported in Prisma 7.0.0. To learn more \
visit https://pris.ly/cli/output-path`

export class PrismaClientJsGenerator implements Generator {
  readonly name = 'prisma-client-js'

  #shouldResolvePrismaClient = true
  #runtimePath?: string
  #cachedPrismaClientPath: string | undefined

  constructor({ shouldResolvePrismaClient = true, runtimePath }: PrismaClientJsGeneratorOptions = {}) {
    this.#shouldResolvePrismaClient = shouldResolvePrismaClient
    this.#runtimePath = runtimePath
  }

  async getManifest(config: GeneratorConfig): Promise<GeneratorManifest> {
    const requiresEngines = match<ClientEngineType, EngineType[]>(getClientEngineType(config))
      .with(ClientEngineType.Library, () => ['libqueryEngine'])
      .with(ClientEngineType.Binary, () => ['queryEngine'])
      .with(ClientEngineType.Client, () => [])
      .exhaustive()

    debug('requiresEngines', requiresEngines)

    if (!config.output) {
      console.warn(MISSING_CUSTOM_OUTPUT_PATH_WARNING)
    }

    // If `this.#shouldResolvePrismaClient` is true, which is normally the case,
    // we find the default output path by resolving the path to the
    // `@prisma/client` package. While we resolve the absolute path to the
    // package itself, the generator will rewrite it to replace
    // `.../@prisma/client` with `.../.prisma/client`, as long as
    // `config.isCustomOutput` is false.
    //
    // If a custom output path is provided, then the default output path doesn't
    // matter and we could use a static value here, but that unfortunately
    // wouldn't allow us to avoid resolving the client directory and would only
    // delay that until the `generate` method call because we copy the runtime
    // files if a custom output path is used, and we also copy the WASM modules
    // regardles of the output path. Not copying the runtime files is a breaking
    // change, so we can only completely get rid of this behaviour in the new
    // generator.
    //
    // If `this.#shouldResolvePrismaClient` is false, which is the case when
    // using the JSON-RPC compatibility adapter for Prisma Studio, we should use
    // a static value here.
    const defaultOutput = this.#shouldResolvePrismaClient ? await this.#getPrismaClientPath(config) : '.prisma/client'

    return {
      defaultOutput,
      prettyName: 'Prisma Client',
      version: clientVersion,
      requiresEngines,
      requiresEngineVersion: enginesVersion,
    }
  }

  async generate(options: GeneratorOptions): Promise<void> {
    const outputDir = parseEnvValue(options.generator.output!)

    await generateClient({
      datamodel: options.datamodel,
      schemaPath: options.schemaPath,
      binaryPaths: options.binaryPaths!,
      datasources: options.datasources,
      envPaths: options.envPaths,
      outputDir,
      copyRuntime: Boolean(options.generator.config.copyRuntime),
      copyRuntimeSourceMaps: Boolean(process.env.PRISMA_COPY_RUNTIME_SOURCEMAPS),
      runtimeSourcePath: await this.#getRuntimePath(options.generator),
      dmmf: options.dmmf,
      generator: options.generator,
      engineVersion: options.version,
      clientVersion,
      activeProvider: options.datasources[0]?.activeProvider,
      postinstall: options.postinstall,
      copyEngine: !options.noEngine,
      typedSql: options.typedSql,
    })
  }

  async #getPrismaClientPath(config: GeneratorConfig): Promise<string> {
    if (this.#cachedPrismaClientPath) {
      return this.#cachedPrismaClientPath
    }

    this.#cachedPrismaClientPath = await resolvePrismaClient(path.dirname(config.sourceFilePath))
    return this.#cachedPrismaClientPath
  }

  async #getRuntimePath(config: GeneratorConfig): Promise<string> {
    if (this.#runtimePath) {
      return this.#runtimePath
    }

    this.#runtimePath = path.join(await this.#getPrismaClientPath(config), 'runtime')
    return this.#runtimePath
  }
}
