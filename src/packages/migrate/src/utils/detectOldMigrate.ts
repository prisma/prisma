import fs from 'fs'
import path from 'path'

export function isOldMigrate(migrationDirPath: string): boolean {
  return fs.existsSync(path.join(migrationDirPath, 'migrate.lock'))
}
