import type { ConfigMetaFormat } from '../../../engine-commands'

import { mongoFeatureFlagMissingMessage } from './mongoFeatureFlagMissingMessage'
import { proxyFeatureFlagMissingMessage } from './proxyFeatureFlagMissingMessage'

export function checkFeatureFlags(config: ConfigMetaFormat) {
  checkMongoFeatureFlag(config)
}

function checkMongoFeatureFlag(config: ConfigMetaFormat) {
  if (
    config.datasources.some((d) => d.provider === 'mongodb') &&
    !config.generators.some((g) => {
      return g.previewFeatures.some(
        (previewFeature) =>
          previewFeature.toLowerCase() === 'mongoDb'.toLowerCase(),
      )
    })
  ) {
    throw new Error(mongoFeatureFlagMissingMessage)
  }
}
