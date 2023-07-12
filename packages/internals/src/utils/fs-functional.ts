import { pipe } from 'fp-ts/lib/function'
import * as T from 'fp-ts/lib/Task'
import * as TE from 'fp-ts/lib/TaskEither'
import fs from 'fs/promises'

import * as fsUtils from './fs-utils'

export const createDirIfNotExists = (dir: string) =>
  TE.tryCatch(() => fsUtils.createDirIfNotExists(dir), createTaggedSystemError('fs-create-dir', { dir }))

export const writeFile = (params: { path: string; content: string }) =>
  TE.tryCatch(() => fsUtils.writeFile(params), createTaggedSystemError('fs-write-file', params))

export const removeEmptyDirs = (dir: string) =>
  TE.tryCatch(() => fsUtils.removeEmptyDirs(dir), createTaggedSystemError('fs-remove-empty-dirs', { dir }))

export const removeDir = (dir: string) =>
  pipe(TE.tryCatch(() => fs.rm(dir, { recursive: true }), createTaggedSystemError('fs-remove-dir', { dir })))

export const removeFile = (filePath: string) =>
  pipe(TE.tryCatch(() => fs.unlink(filePath), createTaggedSystemError('fs-remove-file', { filePath })))

export const getNestedFoldersInDir =
  (dir: string): T.Task<string[]> =>
  () =>
    fsUtils.getNestedFoldersInDir(dir)

export const getFilesInDir =
  (dir: string, pattern = '**'): T.Task<string[]> =>
  () =>
    fsUtils.getFilesInDir(dir, pattern)

/**
 * Closure that creates a tagged system error for a given error callback.
 * @param type the tag type for the error, e.g. 'fs-create-dir'
 * @param meta any additional metadata about what caused the error
 */
function createTaggedSystemError<Tag extends string, Meta extends Record<string, unknown>>(type: Tag, meta: Meta) {
  return (e: Error | unknown /* untyped error */) =>
    ({
      type,
      error: e as Error & { code: string },
      meta,
    } as const)
}
