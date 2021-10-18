import type { ConfigMetaFormat } from '../../../engine-commands'

import { mongoFeatureFlagMissingMessage } from './mongoFeatureFlagMissingMessage'
import { proxyFeatureFlagMissingMessage } from './proxyFeatureFlagMissingMessage'

export function checkFeatureFlags(config: ConfigMetaFormat) {
  checkMongoFeatureFlag(config)
  checkProxyFeatureFlag(config)
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

function checkProxyFeatureFlag(config: ConfigMetaFormat) {
  if (
    (config.generators.some((g) => g.config.engineType === 'dataproxy') ||
      process.env.PRISMA_CLIENT_ENGINE_TYPE === 'dataproxy') &&
    !config.generators.some((g) => {
      return g.previewFeatures.some(
        (previewFeature) =>
          previewFeature.toLowerCase() === 'dataProxy'.toLowerCase(),
      )
    })
  ) {
    throw new Error(proxyFeatureFlagMissingMessage)
  }
}
