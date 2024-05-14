import path from 'node:path'

import { FilesResolver, realFsResolver } from './resolver'

export type LoadedFile = [filePath: string, content: string]

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
export async function loadSchemaFiles(
  folderPath: string,
  filesResolver: FilesResolver = realFsResolver,
): Promise<LoadedFile[]> {
  const dirEntries = await filesResolver.listDirContents(folderPath)
  const validatedList = await Promise.all(
    dirEntries.map((filePath) => validateFilePath(path.join(folderPath, filePath), filesResolver)),
  )
  return validatedList.reduce((acc, entry) => {
    if (entry.valid) {
      acc.push([entry.fullPath, entry.content])
    }
    return acc
  }, [] as LoadedFile[])
}

async function validateFilePath(fullPath: string, filesResolver: FilesResolver): Promise<InternalValidatedEntry> {
  if (path.extname(fullPath) !== '.prisma') {
    return { valid: false }
  }
  const fileType = await filesResolver.getEntryType(fullPath)

  if (!fileType) {
    return { valid: false }
  }
  if (fileType.kind === 'file') {
    const content = await filesResolver.getFileContents(fullPath)
    if (typeof content === 'undefined') {
      return { valid: false }
    }
    return { valid: true, fullPath, content }
  }
  if (fileType.kind === 'symlink') {
    const realPath = fileType.realPath
    return validateFilePath(realPath, filesResolver)
  }
  return { valid: false }
}
