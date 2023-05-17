import fs from 'fs/promises'
import globby from 'globby'
import path from 'path'

import { pathToPosix } from './path'

/**
 * Create a directory if it doesn't exist yet.
 * Note: { recursive: true } prevents EEEXIST error codes when the directory already exists.
 * This function can potentially fail (e.g., if the user doesn't have permissions to create the directory).
 */
export function createDirIfNotExists(dir: string): Promise<string | undefined> {
  return fs.mkdir(dir, { recursive: true })
}

/**
 * Create a file with the given content.
 * This function can potentially fail (e.g., if the user doesn't have permissions to create the file).
 */
export function writeFile({ path, content }: { path: string; content: string }): Promise<void> {
  return fs.writeFile(path, content, { encoding: 'utf-8' })
}

/**
 * Retrieve any foolder in the given directory, at the top-level of depth.
 */
export async function getTopLevelFoldersInDir(dir: string): Promise<string[]> {
  const rawFolders = await fs.readdir(dir, { withFileTypes: true })
  return rawFolders
    .filter((fileOrFolder) => fileOrFolder.isDirectory())
    .map((folder) => pathToPosix(path.join(dir, folder.name)))
}

/**
 * Retrieve any folder nested into the given directory, at any level of depth.
 */
export function getNestedFoldersInDir(dir: string): Promise<string[]> {
  const normalizedDir = pathToPosix(path.join(dir, '**'))
  return globby(normalizedDir, { onlyFiles: false, onlyDirectories: true })
}

export function getFilesInDir(dir: string, pattern = '**'): Promise<string[]> {
  const normalizedDir = pathToPosix(path.join(dir, pattern))
  return globby(normalizedDir, { onlyFiles: true, onlyDirectories: false })
}

/**
 * Removes all empty directories in the given directory.
 * If at the end of the recursion the given directory is empty, that
 * directory is removed as well.
 * Note: this function can potentially fail (e.g., if the user doesn't have permissions to remove a directory).
 */
export async function removeEmptyDirs(dir: string): Promise<void> {
  try {
    const fileStats = await fs.lstat(dir)
    if (!fileStats.isDirectory()) {
      return
    }
  } catch (e) {
    // If the directory doesn't exist, we don't need to remove it.
    // This is not an error.
    return
  }

  const filenames = await fs.readdir(dir)
  if (filenames.length > 0) {
    const recursionPromises = filenames.map((filename) => removeEmptyDirs(path.join(dir, filename)))
    await Promise.all(recursionPromises)
  }

  const filenamesAfterRec = await fs.readdir(dir)
  if (filenamesAfterRec.length === 0) {
    await fs.rmdir(dir)
  }
}
