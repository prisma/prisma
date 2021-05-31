import { ConfigMetaFormat } from '../engine-commands'
import { parseProviderEnvValue } from './parseEnvValue'

export function extractPreviewFeatures(config: ConfigMetaFormat): string[] {
  return (
    config.generators.find(
      (g) => parseProviderEnvValue(g.provider) === 'prisma-client-js',
    )?.previewFeatures || []
  )
}
