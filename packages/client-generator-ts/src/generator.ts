import Debug from '@prisma/debug'
import { enginesVersion } from '@prisma/engines-version'
import { EngineType, Generator, GeneratorConfig, GeneratorManifest, GeneratorOptions } from '@prisma/generator'
import { ClientEngineType, getClientEngineType, parseEnvValue } from '@prisma/internals'
import { bold, dim, green } from 'kleur/colors'
import { match } from 'ts-pattern'

import { version as clientVersion } from '../package.json'
import { generateClient } from './generateClient'
import { parseRuntimeTargetFromUnknown } from './runtime-targets'

const debug = Debug('prisma:client:generator')

const missingOutputErrorMessage = `An output path is required for the \`prisma-client-ts\` generator. Please provide an output path in your schema file:

${dim(`generator client {
  provider = "prisma-client-ts"`)}
${green('  output   = "../src/generated"')}
${dim('}')}

${bold('Note:')} the output path is relative to the schema directory.
`

function getOutputPath(config: GeneratorConfig): string {
  if (!config.output) {
    throw new Error(missingOutputErrorMessage)
  }
  return parseEnvValue(config.output)
}

export class PrismaClientTsGenerator implements Generator {
  readonly name = 'prisma-client-ts'

  getManifest(config: GeneratorConfig): Promise<GeneratorManifest> {
    const requiresEngines = match<ClientEngineType, EngineType[]>(getClientEngineType(config))
      .with(ClientEngineType.Library, () => ['libqueryEngine'])
      .with(ClientEngineType.Binary, () => ['queryEngine'])
      .with(ClientEngineType.Client, () => [])
      .exhaustive()

    debug('requiresEngines', requiresEngines)

    return Promise.resolve({
      defaultOutput: getOutputPath(config),
      prettyName: 'Prisma Client',
      version: clientVersion,
      requiresEngines,
      requiresEngineVersion: enginesVersion,
    })
  }

  async generate(options: GeneratorOptions): Promise<void> {
    await generateClient({
      datamodel: options.datamodel,
      schemaPath: options.schemaPath,
      binaryPaths: options.binaryPaths!,
      datasources: options.datasources,
      envPaths: options.envPaths,
      outputDir: getOutputPath(options.generator),
      runtimeBase: '@prisma/client/runtime',
      dmmf: options.dmmf,
      generator: options.generator,
      engineVersion: options.version,
      clientVersion,
      activeProvider: options.datasources[0]?.activeProvider,
      postinstall: options.postinstall,
      copyEngine: !options.noEngine,
      typedSql: options.typedSql,
      target:
        options.generator.config.runtime !== undefined
          ? parseRuntimeTargetFromUnknown(options.generator.config.runtime)
          : 'nodejs',
    })
  }
}
