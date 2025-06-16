import { PrismaConfigInternal } from '@prisma/config'
import path from 'path'

import { SchemaContext } from './schemaContext'

export type DirectoryConfig = {
  viewsDirPath: string
  typedSqlDirPath: string
  migrationsDirPath: string
}

// TODO: Pass PrismaConfig as second argument to enable setting custom directory paths. See ORM-663 & ORM-664.
export function inferDirectoryConfig(
  schemaContext?: SchemaContext | null,
  config?: PrismaConfigInternal,
  cwd: string = process.cwd(),
): DirectoryConfig {
  const baseDir =
    // All default paths are relative to the `schema.prisma` file that contains the primary datasource.
    // That schema file should usually be the users "root" aka main schema file.
    schemaContext?.primaryDatasourceDirectory ??
    // If no primary datasource exists we use the schemaRootDir.
    // `schemaRootDir` is either the directory the user supplied as schemaPath or the directory the single schema file is in.
    schemaContext?.schemaRootDir ??
    // Should also that not be defined because there is no schema yet we fallback to CWD + `/prisma`.
    path.join(cwd, 'prisma')

  return {
    viewsDirPath: path.join(baseDir, 'views'),
    typedSqlDirPath: path.join(baseDir, 'sql'),
    migrationsDirPath: config?.migrate?.migrationsDirectory ?? path.join(baseDir, 'migrations'),
  }
}
