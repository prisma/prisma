#!/usr/bin/env ts-node

import { generatorHandler } from '@prisma/generator-helper'
import Debug from 'debug'
import { generateClient } from './generation/generateClient'
const debug = Debug('photonjs-generator')

generatorHandler({
  onManifest() {
    return {
      defaultOutput: 'node_modules/@generated/photon',
      denylists: {
        models: [
          'Enumerable',
          'MergeTruthyValues',
          'CleanupNever',
          'AtLeastOne',
          'OnlyOne',
          'StringFilter',
          'IDFilter',
          'FloatFilter',
          'IntFilter',
          'BooleanFilter',
          'DateTimeFilter',
          'NullableStringFilter',
          'NullableIDFilter',
          'NullableFloatFilter',
          'NullableIntFilter',
          'NullableBooleanFilter',
          'NullableDateTimeFilter',
          'PhotonFetcher',
          'Photon',
          'Engine',
          'PhotonOptions',
        ],
        fields: ['AND', 'OR', 'NOT'],
      },
      prettyName: 'Photon.js',
      requiresEngines: ['queryEngine', 'migrationEngine'],
    }
  },
  async onGenerate(options) {
    debug('generatin')
    debug(options.generator)
    await generateClient({
      datamodel: options.datamodel,
      datamodelPath: options.schemaPath,
      binaryPaths: options.binaryPaths!,
      datasources: options.datasources,
      outputDir: options.generator.output!,
      dmmf: options.dmmf,
      generator: options.generator,
      version: options.version,
    })
  },
})
