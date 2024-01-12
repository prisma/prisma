#!/usr/bin/env node
// @ts-check

const fs = require('fs')
const { getPreviewFeatures } = require('$internals')

async function main() {
  /** @type string[] */
  let previewFeatures
  const featureSet = JSON.parse(process.env.PREVIEW_FEATURE_SET ?? 'none')
  const included = JSON.parse(process.env.INCLUDED_PREVIEW_FEATURES ?? '[]')
  const excluded = JSON.parse(process.env.EXCLUDED_PREVIEW_FEATURES ?? '[]')

  previewFeatures = featureSet === 'all' ? getPreviewFeatures() : included
  previewFeatures = previewFeatures.filter((pf) => !excluded.includes(pf))

  const commaSeparatedPreviewFeaturesString = previewFeatures.join(',')

  if (typeof process.env.GITHUB_OUTPUT == 'string' && process.env.GITHUB_OUTPUT.length > 0) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `previewFeatures=${commaSeparatedPreviewFeaturesString}\n`)
    console.debug(`${commaSeparatedPreviewFeaturesString} added to GITHUB_OUTPUT`)
  }
}

main().then(function () {
  console.log('Done')
})
