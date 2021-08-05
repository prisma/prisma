#!/usr/bin/node

const { generatorHandler } = require('@prisma/generator-helper')

generatorHandler({
  onManifest() {
    return {
      defaultOutput: 'my-generator-output', // the value here doesn't matter, as it's resolved in https://github.com/prisma/prisma/blob/main/cli/sdk/src/getGenerators.ts
      prettyName: 'I depend on the client',
      requiresEngines: [],
      requiresGenerators: ['prisma-client-js'],
    }
  },
  async onGenerate(options) {
    //
  },
})
