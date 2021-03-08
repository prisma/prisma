import Debug from '@prisma/debug'
import { enginesVersion } from '@prisma/engines-version'
import { generatorHandler } from '@prisma/generator-helper'
import { generateClient } from './generation/generateClient'
import { getDMMF } from './generation/getDMMF'
import { externalToInternalDmmf } from './runtime/externalToInternalDmmf'
const debug = Debug('prisma:client:generator')

// As specced in https://github.com/prisma/specs/tree/master/generators

const pkg = require('../package.json')
const clientVersion = pkg.version

generatorHandler({
  onManifest(config) {
    const requiredEngine =
      config?.previewFeatures?.includes('napi') || process.env.NAPI === 'true'
        ? 'libqueryEngineNapi'
        : 'queryEngine'
    debug(`requiredEngine: ${requiredEngine}`)
    return {
      defaultOutput: '@prisma/client', // the value here doesn't matter, as it's resolved in https://github.com/prisma/prisma/blob/master/cli/sdk/src/getGenerators.ts
      prettyName: 'Prisma Client',
      requiresEngines: [requiredEngine],
      version: clientVersion,
      requiresEngineVersion: enginesVersion,
    }
  },
  async onGenerate(options) {
    // TODO @timsuchanek Any idea what this is for?
    debug('__dirname', __dirname)
    debug(eval(`__dirname`)) // tslint:disable-line

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
      activeProvider: options.datasources[0]?.activeProvider,
    })
  },
})

export { getDMMF, externalToInternalDmmf }
