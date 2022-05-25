import type { ConfigMetaFormat } from '../../../engine-commands'
import { GetGeneratorOptions } from '../../getGenerators'
import { forbiddenItxWithDataProxyFlagMessage } from './forbiddenTransactionsWithProxyFlagMessage'

/**
 * Check feature flags and preview features
 * @param config
 * @param options
 */
export function checkFeatureFlags(config: ConfigMetaFormat, options: GetGeneratorOptions) {
  checkForbiddenItxWithDataProxyFlag(config, options)
}

function checkForbiddenItxWithDataProxyFlag(config: ConfigMetaFormat, options: GetGeneratorOptions) {
  if (
    options.dataProxy === true &&
    config.generators.some((generatorConfig) => {
      return generatorConfig.previewFeatures.some(
        (feature) => feature.toLocaleLowerCase() === 'interactiveTransactions'.toLocaleLowerCase(),
      )
    })
  ) {
    throw new Error(forbiddenItxWithDataProxyFlagMessage)
  }
}

/* Example
function checkMongoFeatureFlag(config: ConfigMetaFormat) {
  if (
    config.datasources.some((d) => d.provider === 'mongodb') &&
    !config.generators.some((g) => {
      return g.previewFeatures.some((previewFeature) => previewFeature.toLowerCase() === 'mongoDb'.toLowerCase())
    })
  ) {
    throw new Error(mongoFeatureFlagMissingMessage)
  }
}
*/
