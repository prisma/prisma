import { ConfigMetaFormat } from '../engineCommands'
import { getProviderValue } from '../getGenerators'

export function extractPreviewFeatures(config: ConfigMetaFormat): string[] {
  return (
    config.generators.find(
      (g) => getProviderValue(g.provider) === 'prisma-client-js',
    )?.previewFeatures || []
  )
}
