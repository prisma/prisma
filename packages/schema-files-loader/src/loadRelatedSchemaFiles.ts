import path from 'node:path'

import { get_config } from '@prisma/prisma-schema-wasm'

import { type LoadedFile, loadSchemaFiles } from './loadSchemaFiles'
import { type FilesResolver, realFsResolver } from './resolver'
import { type GetConfigResponse, usesPrismaSchemaFolder } from './usesPrismaSchemaFolder'

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
  const files = await loadSchemaFiles(rootDir, filesResolver)
  if (isPrismaFolderEnabled(files)) {
    return files
  }
  // if feature is not enabled, return only supplied file
  return singleFile(filePath, filesResolver)
}

async function singleFile(filePath: string, filesResolver: FilesResolver): Promise<LoadedFile[]> {
  const contents = await filesResolver.getFileContents(filePath)
  if (contents === undefined) {
    return []
  }
  return [[filePath, contents]]
}

function isPrismaFolderEnabled(files: LoadedFile[]): boolean {
  const params = JSON.stringify({
    prismaSchema: files,
    datasourceOverrides: {},
    ignoreEnvVarErrors: true,
    env: {},
  })

  try {
    const response = JSON.parse(get_config(params)) as GetConfigResponse
    return usesPrismaSchemaFolder(response.config)
  } catch (_e) {
    return false
  }
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
