import path from 'node:path'

import { LoadedFile, loadSchemaFiles } from './loadSchemaFiles'
import { FilesResolver, realFsResolver } from './resolver'

/**
 * Given a single file path, returns
 * all files composing the same schema
 * @param filePath
 * @param filesResolver
 * @returns
 */
export async function loadRelatedSchemaFiles(
  filePath: string,
  filesResolver: FilesResolver = realFsResolver,
): Promise<LoadedFile[]> {
  const rootDir = await findSchemaRoot(filePath, filesResolver)
  if (!rootDir) {
    return singleFile(filePath, filesResolver)
  }
  return await loadSchemaFiles(rootDir, filesResolver)
}

async function singleFile(filePath: string, filesResolver: FilesResolver): Promise<LoadedFile[]> {
  const contents = await filesResolver.getFileContents(filePath)
  if (contents === undefined) {
    return []
  }
  return [[filePath, contents]]
}

async function findSchemaRoot(filePath: string, filesResolver: FilesResolver): Promise<string | undefined> {
  let dir = path.dirname(filePath)
  while (dir !== filePath) {
    const parentDir = path.dirname(dir)
    const contents = await filesResolver.listDirContents(parentDir)
    const prismaFiles = contents.filter((file) => path.extname(file) === '.prisma')
    if (prismaFiles.length === 0) {
      // No prisma files in directory, found root dir
      return dir
    }
    dir = parentDir
  }

  // walked all the way to the root - should probably never happen, but it case it does
  // let's say we have not found anything
  return undefined
}
