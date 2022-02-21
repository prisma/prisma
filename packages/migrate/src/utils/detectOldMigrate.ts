import fs from 'fs'
import path from 'path'

import { OldMigrateDetectedError } from './errors'

export function isOldMigrate(migrationDirPath: string): boolean {
  return fs.existsSync(path.join(migrationDirPath, 'migrate.lock'))
}

export function throwUpgradeErrorIfOldMigrate(schemaPath?: string): Error | void {
  if (!schemaPath) {
    return
  }

  const migrationDirPath = path.join(path.dirname(schemaPath), 'migrations')
  if (isOldMigrate(migrationDirPath)) {
    throw new OldMigrateDetectedError()
  }
}
