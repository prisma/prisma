#!/usr/bin/env node
// @ts-check

const fs = require('fs')
const { getPreviewFeatures } = require('$internals')

async function main() {
  // ci expects it as a singular string
  const previewFeatures = getPreviewFeatures().join(',')

  if (typeof process.env.GITHUB_OUTPUT == 'string' && process.env.GITHUB_OUTPUT.length > 0) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `previewFeatures=${previewFeatures}\n`)
    console.debug(`${previewFeatures} added to GITHUB_OUTPUT`)
  }
}

main().then(function () {
  console.log('Done')
})
