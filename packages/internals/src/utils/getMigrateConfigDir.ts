import path from 'node:path'

import type { ConfigMetaFormat } from '../engine-commands'

export function getMigrateConfigDir(config: ConfigMetaFormat, schemaPath: string | undefined) {
  const sourcePath = config?.datasources?.[0]?.sourceFilePath
  if (sourcePath) {
    return path.dirname(sourcePath)
  }
  return schemaPath ? path.dirname(schemaPath) : process.cwd()
}
