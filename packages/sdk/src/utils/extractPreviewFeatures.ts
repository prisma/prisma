import type { ConfigMetaFormat } from '../engine-commands'
import { parseEnvValue } from './parseEnvValue'

export function extractPreviewFeatures(config: ConfigMetaFormat): string[] {
  // TODO: remove parseEnvValue
  return config.generators.find((g) => parseEnvValue(g.provider) === 'prisma-client-js')?.previewFeatures || []
}
