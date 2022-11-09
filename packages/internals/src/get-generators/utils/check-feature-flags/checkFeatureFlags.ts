import type { ConfigMetaFormat } from '../../../engine-commands'
import { GetGeneratorOptions } from '../../getGenerators'
import { forbiddenPreviewFeatureWithDataProxyFlagMessage } from './forbiddenPreviewFeatureWithProxyFlagMessage'

/**
 * Check feature flags and preview features
 * @param config
 * @param options
 */
export function checkFeatureFlags(config: ConfigMetaFormat, options: GetGeneratorOptions) {
  checkForbiddenFeaturesWithDataProxyFlag(config, options)
}

function checkForbiddenFeaturesWithDataProxyFlag(config: ConfigMetaFormat, options: GetGeneratorOptions) {
  options.dataProxy === true &&
    config.generators.some((generatorConfig) => {
      return generatorConfig.previewFeatures.some((feature) => {
        if (feature.toLocaleLowerCase() === 'metrics'.toLocaleLowerCase()) {
          throw new Error(forbiddenPreviewFeatureWithDataProxyFlagMessage('metrics'))
        }

        if (feature.toLocaleLowerCase() === 'tracing'.toLocaleLowerCase()) {
          throw new Error(forbiddenPreviewFeatureWithDataProxyFlagMessage('tracing'))
        }
      })
    })
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
