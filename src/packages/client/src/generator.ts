import { generatorHandler } from '@prisma/generator-helper'
import Debug from '@prisma/debug'
import { generateClient } from './generation/generateClient'
import { getDMMF } from './generation/getDMMF'
import { enginesVersion } from '@prisma/engines-version'
import { externalToInternalDmmf } from './runtime/externalToInternalDmmf'
import { logger } from '@prisma/sdk'
const debugEnabled = Debug.enabled('prisma-client:generator')

// As specced in https://github.com/prisma/specs/tree/master/generators

const pkg = require('../package.json')
const clientVersion = pkg.version

generatorHandler({
  onManifest() {
    return {
      defaultOutput: '@prisma/client', // the value here doesn't matter, as it's resolved in https://github.com/prisma/prisma/blob/master/cli/sdk/src/getGenerators.ts
      prettyName: 'Prisma Client',
      requiresEngines: ['queryEngine'],
      version: clientVersion,
      requiresEngineVersion: enginesVersion,
    }
  },
  async onGenerate(options) {
    if (debugEnabled) {
      logger.log('__dirname', __dirname)
      logger.log(eval(`__dirname`)) // tslint:disable-line
    }

    return generateClient({
      datamodel: options.datamodel,
      datamodelPath: options.schemaPath,
      binaryPaths: options.binaryPaths!,
      datasources: options.datasources,
      outputDir: options.generator.output!,
      copyRuntime: Boolean(options.generator.config.copyRuntime),
      dmmf: options.dmmf,
      generator: options.generator,
      engineVersion: options.version,
      clientVersion,
      transpile: true,
    })
  },
})

export { getDMMF, externalToInternalDmmf }
