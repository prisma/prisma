/**
 * A JSON-RPC adapter for the `prisma-client-js` generator. It is only used by Studio.
 *
 * It will be removed in the future.
 */

import path from 'node:path'

import { dmmfToTypes, externalToInternalDmmf, PrismaClientJsGenerator } from '@prisma/client-generator-js'
import { generatorHandler } from '@prisma/generator-helper'

export { dmmfToTypes, externalToInternalDmmf }

if (process.argv[1] === __filename) {
  const generator = new PrismaClientJsGenerator({
    shouldResolvePrismaClient: false,
    runtimePath: path.join(__dirname, '..', 'runtime'),
  })

  generatorHandler({
    onManifest(config) {
      return generator.getManifest(config)
    },

    onGenerate(options) {
      return generator.generate(options)
    },
  })
}
