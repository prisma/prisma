import { ConfigMetaFormat, link } from '@prisma/internals'

export function getHardcodedUrlWarning(config: ConfigMetaFormat) {
  if (
    config.datasources?.[0].provider !== 'sqlite' &&
    (config.datasources?.[0].url.fromEnvVar == null || config.datasources?.[0].directUrl?.fromEnvVar == null)
  ) {
    return `\n🛑 Hardcoding URLs in your schema poses a security risk: ${link('https://pris.ly/d/datasource-env')}\n`
  }

  return ''
}
