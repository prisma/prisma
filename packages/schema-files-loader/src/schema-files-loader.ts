import path from 'node:path'

import fs from 'fs-extra'

type LoadedFile = [filePath: string, content: string]

type InternalValidatedEntry =
  | {
      valid: false
    }
  | {
      valid: true
      fullPath: string
      content: string
    }

/**
 * Given folder name, returns list of all files composing a single prisma schema
 * @param folderPath
 */
export async function loadSchemaFiles(folderPath: string): Promise<LoadedFile[]> {
  const dirEntries = await fs.readdir(folderPath)
  const validatedList = await Promise.all(
    dirEntries.map((filePath) => validateFilePath(path.join(folderPath, filePath))),
  )
  return validatedList.reduce((acc, entry) => {
    if (entry.valid) {
      acc.push([entry.fullPath, entry.content])
    }
    return acc
  }, [] as LoadedFile[])
}

async function validateFilePath(fullPath: string): Promise<InternalValidatedEntry> {
  if (path.extname(fullPath) !== '.prisma') {
    return { valid: false }
  }
  const stat = await fs.lstat(fullPath)

  if (stat.isFile()) {
    return { valid: true, fullPath, content: await fs.readFile(fullPath, 'utf8') }
  }
  if (stat.isSymbolicLink()) {
    const realPath = await fs.realpath(fullPath)
    const realPathStat = await fs.stat(realPath)
    if (realPathStat.isFile()) {
      return { valid: true, fullPath: realPath, content: await fs.readFile(realPath, 'utf8') }
    }
    return { valid: false }
  }
  return { valid: false }
}

export function loadRelatedSchemaFiles(filesPath: string): Promise<LoadedFile[]> {
  // TODO: this should read preview features from the found files.
  // If `prismaSchemaFolder` is not enabled, it should only return the entry for `filePaths`
  // and not any other file
  return loadSchemaFiles(path.dirname(filesPath))
}
