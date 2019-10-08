#!/usr/bin/env ts-node

import { generatorHandler } from '@prisma/generator-helper'
import Debug from 'debug'
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
  },
})
