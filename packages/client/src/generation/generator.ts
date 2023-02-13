import Debug from '@prisma/debug'
import { enginesVersion } from '@prisma/engines-version'
import { generatorHandler } from '@prisma/generator-helper'
import { ClientEngineType, getClientEngineType, parseEnvValue } from '@prisma/internals'

import { externalToInternalDmmf } from '../runtime/externalToInternalDmmf'
import { generateClient } from './generateClient'
import { dmmfToTypes } from './utils/types/dmmfToTypes'

const debug = Debug('prisma:client:generator')

// See https://www.notion.so/prismaio/Prisma-Generators-a2cdf262207a4e9dbcd0e362dfac8dc0

const pkg = require('../../package.json')

const clientVersion = pkg.version

// if the file has been run as a CLI
if (process.argv[1] === __filename) {
  generatorHandler({
    onManifest(config) {
      const requiredEngine = getClientEngineType(config) === ClientEngineType.Library ? 'libqueryEngine' : 'queryEngine'
      debug(`requiredEngine: ${requiredEngine}`)
      return {
        defaultOutput: '.prisma/client', // the value here doesn't matter, as it's resolved in https://github.com/prisma/prisma/blob/88fe98a09092d8e53e51f11b730c7672c19d1bd4/packages/sdk/src/get-generators/getGenerators.ts
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
        schemaPath: options.schemaPath,
        binaryPaths: options.binaryPaths!,
        datasources: options.datasources,
        outputDir,
        copyRuntime: Boolean(options.generator.config.copyRuntime),
        copyRuntimeSourceMaps: Boolean(process.env.PRISMA_COPY_RUNTIME_SOURCEMAPS),
        dmmf: options.dmmf,
        generator: options.generator,
        engineVersion: options.version,
        clientVersion,
        transpile: true,
        activeProvider: options.datasources[0]?.activeProvider,
        dataProxy: options.dataProxy,
      })
    },
  })
}

export { dmmfToTypes, externalToInternalDmmf }
