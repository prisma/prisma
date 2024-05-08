import path from 'node:path'

import { get_config } from '@prisma/prisma-schema-wasm'

import { LoadedFile, loadSchemaFiles } from './loadSchemaFiles'
import { FilesResolver, realFsResolver } from './resolver'
import { ConfigMetaFormat, usesPrismaSchemaFolder } from './usesPrismaSchemaFolder'

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
  // TODO: this should read preview features from the found files.
  // If `prismaSchemaFolder` is not enabled, it should only return the entry for `filePaths`
  // and not any other file
  const files = await loadSchemaFiles(path.dirname(filePath), filesResolver)
  if (isPrismaFolderEnabled(files)) {
    return files
  }
  // if feature is not enabled, return only supplied file
  const contents = await filesResolver.getFileContents(filePath)
  if (!contents) {
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
    const response = JSON.parse(get_config(params)) as ConfigMetaFormat
    return usesPrismaSchemaFolder(response)
  } catch (e) {
    return false
  }
}
