import { ConfigMetaFormat } from '@prisma/internals'

export function getHardcodedUrlWarning(config: ConfigMetaFormat) {
  if (config.datasources?.[0].provider !== 'sqlite' && config.datasources?.[0].url.fromEnvVar == null) {
    return `\n🛑 Hardcoding URLs in your schema poses a security risk, use \`env("DATABASE_URL")\`\n`
  }

  return ''
}
