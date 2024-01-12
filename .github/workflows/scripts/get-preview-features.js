#!/usr/bin/env node
// @ts-check

const fs = require('fs')
const { getPreviewFeatures } = require('$internals')

async function main() {
  /** @type string */
  let previewFeatures
  const exclusivePreviewFeatures = JSON.parse(process.env.EXCLUSIVE_PREVIEW_FEATURES || '[]')
  const excludedPreviewFeatures = JSON.parse(process.env.EXCLUDED_PREVIEW_FEATURES || '[]')

  if (exclusivePreviewFeatures.length > 0) {
    previewFeatures = exclusivePreviewFeatures.join(',')
  } else {
    const allPreviewFeatures = getPreviewFeatures()
    previewFeatures = allPreviewFeatures.filter((feature) => !excludedPreviewFeatures.includes(feature)).join(',')
  }

  if (typeof process.env.GITHUB_OUTPUT == 'string' && process.env.GITHUB_OUTPUT.length > 0) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `previewFeatures=${previewFeatures}\n`)
    console.debug(`${previewFeatures} added to GITHUB_OUTPUT`)
  }
}

main().then(function () {
  console.log('Done')
})
