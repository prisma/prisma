import Debug from '@prisma/debug'
import { enginesVersion } from '@prisma/engines-version'
import { generatorHandler } from '@prisma/generator-helper'
import { parseEnvValue } from '@prisma/sdk'
import { generateClient } from './generation/generateClient'
import { getDMMF } from './generation/getDMMF'
import { externalToInternalDmmf } from './runtime/externalToInternalDmmf'
const debug = Debug('prisma:client:generator')

// As specced in https://github.com/prisma/specs/tree/master/generators

const pkg = require('../package.json')
const clientVersion = pkg.version

if (require.main === module) {
  generatorHandler({
    onManifest(config) {
      const requiredEngine =
        config?.previewFeatures?.includes('nApi') ||
        process.env.PRISMA_FORCE_NAPI === 'true'
          ? 'libqueryEngine'
          : 'queryEngine'
      debug(`requiredEngine: ${requiredEngine}`)
      return {
        defaultOutput: '.prisma/client', // the value here doesn't matter, as it's resolved in https://github.com/prisma/prisma/blob/master/cli/sdk/src/getGenerators.ts
        prettyName: 'Prisma Client',
        requiresEngines: [requiredEngine],
        version: clientVersion,
        requiresEngineVersion: enginesVersion,
      }
    },
    async onGenerate(options) {
      // CLI versions < 2.20.0 still send a string
      // CLIs >= 2.20.0 send an `EnvValue`
      const outputDir =
        typeof options.generator.output === 'string'
          ? options.generator.output
          : parseEnvValue(options.generator.output!)

      return generateClient({
        datamodel: options.datamodel,
        datamodelPath: options.schemaPath,
        binaryPaths: options.binaryPaths!,
        datasources: options.datasources,
        outputDir,
        copyRuntime: Boolean(options.generator.config.copyRuntime),
        dmmf: options.dmmf,
        generator: options.generator,
        engineVersion: options.version,
        clientVersion,
        transpile: true,
        activeProvider: options.datasources[0]?.activeProvider,
      })
    },
  })
}

export { getDMMF, externalToInternalDmmf }
