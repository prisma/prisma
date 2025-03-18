import path from 'path'

import { SchemaContext } from './schemaContext'

export type DirectoryConfig = {
  viewsDirPath: string
  typedSqlDirPath: string
  migrationsDirPath: string
}

// TODO: Pass PrismaConfig as second argument to enable setting custom directory paths. See ORM-663 & ORM-664.
export function inferDirectoryConfig(schemaContext?: SchemaContext | null): DirectoryConfig {
  const rootDir = schemaContext?.schemaRootDir ?? path.join(process.cwd(), 'prisma')

  // If the schemaPath points to a file => place the migrations folder next to it.
  // If the schemaPath points to a directory => also place the migrations folder next to it. NOT inside of it!
  const migrationsDirPath = path.join(path.dirname(schemaContext?.schemaPath ?? process.cwd()), 'migrations')

  // TODO: for now simply ported the existing view folder logic here but did not refine it
  const schemaPath = schemaContext?.schemaPath ?? path.join(process.cwd(), 'prisma')
  const prismaDir = path.dirname(schemaPath)
  const viewsDirPath = path.join(prismaDir, 'views')

  return {
    viewsDirPath,
    typedSqlDirPath: path.join(rootDir, 'sql'),
    migrationsDirPath,
  }
}
