#!/usr/bin/env node

const { generatorHandler } = require('../../dist/generatorHandler')

generatorHandler({
  async onGenerate() {
    await new Promise((r) => {
      setTimeout(r, 100)
    })
    console.error('Second last Console error before exit')
    console.error('Last Console error before exit')
    process.exit(1)
  },
  onManifest() {},
})
