import type { Dirent } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import type { MigrateTypes } from '@prisma/internals'

/**
 * Lists migrations present in the migrations directory, sorted lexicographically by name.
 * Returns an empty array if the directory doesn't exist.
 *
 * @param migrationsDirectoryPath Absolute path to the migrations directory
 * @returns Promise resolving to a sorted list of migrations
 */
export async function listMigrations(migrationsDirectoryPath: string): Promise<MigrateTypes.MigrationList> {
  const baseDir = migrationsDirectoryPath

  const lockfilePath = 'migration_lock.toml'
  const lockfileContent = await fs
    .readFile(path.join(migrationsDirectoryPath, lockfilePath), { encoding: 'utf-8' })
    .catch(() => null)

  const lockfile = {
    path: lockfilePath,
    content: lockfileContent,
  } satisfies MigrateTypes.MigrationList['lockfile']

  // Read the directory entries. If a directory doesn't exist, we return an empty array.
  // For any other error, we re-throw it.
  let entries: Dirent[] = []

  try {
    entries = await fs.readdir(migrationsDirectoryPath, { withFileTypes: true, recursive: false }).catch((_) => [])
  } catch (error) {
    // If directory doesn't exist, return an empty array
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        baseDir,
        lockfile,
        migrationDirectories: [],
      }
    }

    throw error
  }

  const migrationDirectories = [] as MigrateTypes.MigrationDirectory[]

  for (const entry of entries.filter((entry) => entry.isDirectory())) {
    const migrationPath = path.join(baseDir, entry.name)

    const migrationFilePath = 'migration.sql'
    const migrationFileContent = await fs
      .readFile(path.join(migrationPath, migrationFilePath), { encoding: 'utf-8' })
      .then((content) => ({ tag: 'ok' as const, value: content }))
      .catch((error) => ({ tag: 'error' as const, value: error as Error }))

    migrationDirectories.push({
      path: entry.name,
      migrationFile: {
        path: migrationFilePath,
        content: migrationFileContent,
      },
    })
  }

  // Sort lexicographically by name
  const sortedMigrations = migrationDirectories.sort((a, b) => a.path.localeCompare(b.path))

  return {
    baseDir,
    lockfile,
    migrationDirectories: sortedMigrations,
  }
}
