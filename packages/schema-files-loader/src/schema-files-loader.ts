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
  const dirEntries = await fs.readdir(folderPath, { withFileTypes: true })
  const validatedList = await Promise.all(dirEntries.map(validateEntry))
  return validatedList.reduce((acc, entry) => {
    if (entry.valid) {
      acc.push([entry.fullPath, entry.content])
    }
    return acc
  }, [] as LoadedFile[])
}

async function validateEntry(entry: fs.Dirent): Promise<InternalValidatedEntry> {
  if (path.extname(entry.name) !== '.prisma') {
    return { valid: false }
  }
  const fullPath = path.join(entry.path, entry.name)
  if (entry.isFile()) {
    return { valid: true, fullPath, content: await fs.readFile(fullPath, 'utf8') }
  }
  if (entry.isSymbolicLink()) {
    const realPath = await fs.realpath(path.join(entry.path, entry.name))
    const stat = await fs.stat(realPath)
    if (stat.isFile()) {
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
