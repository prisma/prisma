import { PrismaClientInitializationError } from '../../../errors/PrismaClientInitializationError'
import type { EngineConfig } from '../..'

export function checkForbiddenMetrics(engineConfig: EngineConfig) {
  const isMetricsEnabled = !!engineConfig.generator?.previewFeatures.some((feature) => {
    return feature.toLowerCase().includes('metrics')
  })

  if (isMetricsEnabled) {
    throw new PrismaClientInitializationError(
      `The \`metrics\` preview feature is not yet available with Accelerate.
Please remove \`metrics\` from the \`previewFeatures\` in your schema.

More information about Accelerate: https://pris.ly/d/accelerate`,
      engineConfig.clientVersion,
    )
  }
}
