import { type ConfigMetaFormat, link } from '@prisma/internals'

export function getHardcodedUrlWarning(config: ConfigMetaFormat) {
  const datasource = config.datasources?.[0]

  if (
    datasource !== undefined &&
    datasource.provider !== 'sqlite' &&
    (datasource.url.fromEnvVar === null || datasource.directUrl?.fromEnvVar === null)
  ) {
    return `\n🛑 Hardcoding URLs in your schema poses a security risk: ${link('https://pris.ly/d/datasource-env')}\n`
  }

  return ''
}
