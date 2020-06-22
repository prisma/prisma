import { ConfigMetaFormat } from '../engineCommands'

export function extractExperimentalFeatures(
  config: ConfigMetaFormat,
): string[] {
  return (
    config.generators.find((g) => g.provider === 'prisma-client-js')
      ?.experimentalFeatures || []
  )
}
