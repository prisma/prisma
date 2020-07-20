import { ConfigMetaFormat } from '../engineCommands'

export function extractPreviewFeatures(config: ConfigMetaFormat): string[] {
  return (
    config.generators.find((g) => g.provider === 'prisma-client-js')
      ?.previewFeatures || []
  )
}
