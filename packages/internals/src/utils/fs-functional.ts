import { pipe } from 'fp-ts/lib/function'
import * as T from 'fp-ts/lib/Task'
import * as TE from 'fp-ts/lib/TaskEither'
import fs from 'fs'
import globby from 'globby'
import path from 'path'

import { pathToPosix } from './path'

export const createDirIfNotExists = (dir: string) =>
  pipe(
    TE.tryCatch(
      // Note: { recursive: true } prevents EEEXIST error codes when the directory already exists
      () => fs.promises.mkdir(dir, { recursive: true }),
      createTaggedSystemError('fs-create-dir', { dir }),
    ),
  )

export const writeFile = ({ path, content }: { path: string; content: string }) =>
  pipe(
    TE.tryCatch(
      () => fs.promises.writeFile(path, content, { encoding: 'utf-8' }),
      createTaggedSystemError('fs-write-file', { path, content }),
    ),
  )

/**
 * Note to future self: in Node.js, `removeDir` and `removeFile` can both be implemented with a single `fs.promises.rm` call.
 */

export const removeDir = (dir: string) =>
  pipe(
    TE.tryCatch(() => fs.promises.rmdir(dir, { recursive: true }), createTaggedSystemError('fs-remove-dir', { dir })),
  )

export const removeFile = (filePath: string) =>
  pipe(TE.tryCatch(() => fs.promises.unlink(filePath), createTaggedSystemError('fs-remove-file', { filePath })))

export const getFoldersInDir =
  (dir: string): T.Task<string[]> =>
  () => {
    const normalizedDir = pathToPosix(path.join(dir, '**'))
    return globby(normalizedDir, { onlyFiles: false, onlyDirectories: true })
  }

export const getFilesInDir =
  (dir: string): T.Task<string[]> =>
  () => {
    const normalizedDir = pathToPosix(path.join(dir, '**'))
    return globby(normalizedDir, { onlyFiles: true, onlyDirectories: false })
  }

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
