#!/usr/bin/node

const { generatorHandler } = require('@prisma/generator-helper')

generatorHandler({
  onManifest() {
    return {
      defaultOutput: 'my-generator-output', // the value here doesn't matter, as it's resolved in https://github.com/prisma/prisma/blob/88fe98a09092d8e53e51f11b730c7672c19d1bd4/packages/sdk/src/get-generators/getGenerators.ts
      prettyName: 'I depend on the client',
      requiresEngines: [],
      requiresGenerators: ['prisma-client-js'],
    }
  },
  async onGenerate(options) {
    //
  },
})
