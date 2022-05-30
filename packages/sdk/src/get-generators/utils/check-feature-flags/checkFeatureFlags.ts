import type { ConfigMetaFormat } from '../../../engine-commands'
import type { GetGeneratorOptions } from '../../getGenerators'
import { forbiddenTransactionsWithProxyFlagMessage } from './forbiddenTransactionsWithProxyFlagMessage'
import { proxyFeatureFlagMissingMessage } from './proxyFeatureFlagMissingMessage'

export function checkFeatureFlags(config: ConfigMetaFormat, options: GetGeneratorOptions) {
  checkProxyFeatureFlag(config)
  checkForbiddenTransactionsWithProxyFlag(config)
}

function checkProxyFeatureFlag(config: ConfigMetaFormat) {
  if (
    (config.generators.some((g) => g.config.engineType === 'dataproxy') ||
      process.env.PRISMA_CLIENT_ENGINE_TYPE === 'dataproxy') &&
    !config.generators.some((g) => {
      return g.previewFeatures.some((previewFeature) => previewFeature.toLowerCase() === 'dataProxy'.toLowerCase())
    })
  ) {
    throw new Error(proxyFeatureFlagMissingMessage)
  }
}

// TODO: this check should be gone as soon as Data Proxy supports Interactive Transactions
function checkForbiddenTransactionsWithProxyFlag(config: ConfigMetaFormat) {
  if (
    config.generators.some((g) => {
      const lowerCasePreviewFeatures = g.previewFeatures.map((pf) => pf.toLowerCase())
      return ['dataProxy', 'interactiveTransactions'].every((pf) => lowerCasePreviewFeatures.includes(pf.toLowerCase()))
    })
  ) {
    throw new Error(forbiddenTransactionsWithProxyFlagMessage)
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
