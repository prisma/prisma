import type { ConfigMetaFormat } from '@prisma/engine-core'
import { parseEnvValue } from '@prisma/internals'

export function extractPreviewFeatures(config: ConfigMetaFormat): string[] {
  return config.generators.find((g) => parseEnvValue(g.provider) === 'prisma-client-js')?.previewFeatures || []
}
