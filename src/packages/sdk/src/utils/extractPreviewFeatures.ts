import { ConfigMetaFormat } from '../engineCommands'
import { parseEnvValue } from './parseEnvValue'

export function extractPreviewFeatures(config: ConfigMetaFormat): string[] {
  return (
    config.generators.find(
      (g) => parseEnvValue(g.provider) === 'prisma-client-js',
    )?.previewFeatures || []
  )
}
