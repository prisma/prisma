import { Generator, GeneratorConfig, GeneratorManifest, GeneratorOptions } from '@prisma/generator'
import { parseEnvValue } from '@prisma/internals'
import { getTsconfig } from 'get-tsconfig'
import { bold, dim, green } from 'kleur/colors'

import { version as clientVersion } from '../package.json'
import { inferImportFileExtension, parseGeneratedFileExtension, parseImportFileExtension } from './file-extensions'
import { generateClient } from './generateClient'
import { inferModuleFormat, parseModuleFormatFromUnknown } from './module-format'
import { parseRuntimeTargetFromUnknown } from './runtime-targets'

const missingOutputErrorMessage = `An output path is required for the \`prisma-client\` generator. Please provide an output path in your schema file:

${dim(`generator client {
  provider = "prisma-client"`)}
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
    return Promise.resolve({
      defaultOutput: getOutputPath(config),
      prettyName: 'Prisma Client',
      version: clientVersion,
    })
  }

  async generate(options: GeneratorOptions): Promise<void> {
    const { config } = options.generator
    const outputDir = getOutputPath(options.generator)
    const tsconfig = getTsconfig(outputDir)?.config

    const target = config.runtime !== undefined ? parseRuntimeTargetFromUnknown(config.runtime) : 'nodejs'

    const generatedFileExtension =
      config.generatedFileExtension !== undefined ? parseGeneratedFileExtension(config.generatedFileExtension) : 'ts'

    const importFileExtension =
      config.importFileExtension !== undefined
        ? parseImportFileExtension(config.importFileExtension)
        : inferImportFileExtension({
            tsconfig,
            generatedFileExtension,
            target,
          })

    const moduleFormat =
      config.moduleFormat !== undefined
        ? parseModuleFormatFromUnknown(config.moduleFormat)
        : inferModuleFormat({
            tsconfig,
            generatedFileExtension,
            importFileExtension,
          })

    await generateClient({
      datamodel: options.datamodel,
      schemaPath: options.schemaPath,
      binaryPaths: options.binaryPaths!,
      datasources: options.datasources,
      envPaths: options.envPaths,
      outputDir,
      runtimeBase: '@prisma/client/runtime',
      dmmf: options.dmmf,
      generator: options.generator,
      engineVersion: options.version,
      clientVersion,
      activeProvider: options.datasources[0]?.activeProvider,
      postinstall: options.postinstall,
      copyEngine: !options.noEngine,
      typedSql: options.typedSql,
      target,
      generatedFileExtension,
      importFileExtension,
      moduleFormat,
      tsNoCheckPreamble: true, // Set to false only during internal tests
    })
  }
}
