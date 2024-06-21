import path from 'path'

import type { ConfigMetaFormat } from '../engine-commands'

export function getMigrateConfigDir(config: ConfigMetaFormat) {
  const sourcePath = config?.datasources?.[0]?.sourceFilePath
  if (sourcePath) {
    return path.dirname(sourcePath)
  }
  return process.cwd()
}
