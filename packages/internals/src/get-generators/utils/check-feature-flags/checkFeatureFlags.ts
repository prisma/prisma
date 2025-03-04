import type { ConfigMetaFormat } from '../../../engine-commands'
import type { GetGeneratorOptions } from '../../getGenerators'

/**
 * Check feature flags and preview features
 * @param config
 * @param options
 */
export function checkFeatureFlags(_config: ConfigMetaFormat, _options: GetGeneratorOptions) {}

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
