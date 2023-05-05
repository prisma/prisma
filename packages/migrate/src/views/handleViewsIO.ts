import { fsFunctional } from '@prisma/internals'
import * as E from 'fp-ts/lib/Either'
import { pipe } from 'fp-ts/lib/function'
import * as T from 'fp-ts/lib/Task'
import * as TE from 'fp-ts/lib/TaskEither'
import path from 'path'
import { match } from 'ts-pattern'

const GARBAGE_REGEX = /(?:Thumbs\.db|\.DS_Store)$/i
export const isGarbageFile = (file) => GARBAGE_REGEX.test(file)

export interface IntrospectionViewDefinition {
  // The database or schema where the view is located
  schema: string

  // The name of the view
  name: string

  // The database SQL query that defines the view
  definition: string
}

type HandleViewsIOParams = {
  views: IntrospectionViewDefinition[]
  schemaPath: string
}

/**
 * For any given view definitions, the CLI must either create or update the corresponding view definition files
 * in the file system, in `${path.dirname(schemaPath)}/views/{viewDbSchema}/{viewName}.sql`.
 * If we did introspect some views
 *  the views directory exists and has some files
 *    if there are subdirectories
 *      any .sql files inside them will be deleted
 *      any empty subdirectories will be deleted
 * If we did not introspect some views
 *  the views directory does not exists -> done
 *  the views directory exists
 *    if there are subdirectories
 *      any .sql files inside them will be deleted
 *      any empty subdirectories will be deleted
 *    views directory is empty? -> delete views directory
 *
 * The .sql files in subdirectories and empty directories are deleted silently.
 */
export async function handleViewsIO({ views, schemaPath }: HandleViewsIOParams): Promise<void> {
  const prismaDir = path.dirname(fsFunctional.normalizePossiblyWindowsDir(schemaPath))
  const viewsDir = path.posix.join(prismaDir, 'views')

  if (views.length === 0) {
    return onNoIntrospectedViews(viewsDir)
  }

  // collect the newest view definitions
  const viewEntries = views.map(({ schema, ...rest }) => {
    const viewDir = path.posix.join(viewsDir, schema)
    return [viewDir, rest] as const
  })

  // collect the paths to the view directories (identified by their db schema name) corresponding to the newest view definitions,
  // which will be created later if they don't exist
  const viewPathsToWrite: string[] = viewEntries.map(([viewDir]) => viewDir)

  // collect the files paths and content for the newest views' SQL definitions, which will be created later if they don't exist
  const viewsFilesToWrite = viewEntries.map(([viewDir, { name, definition }]) => {
    const viewFile = path.posix.join(viewDir, `${name}.sql`)
    return { path: viewFile, content: definition } as const
  })

  const updateDefinitionsInViewsDirPipeline = pipe(
    // create the views directory, idempotently
    fsFunctional.createDirIfNotExists(viewsDir),

    // create the view directories, idempotently and concurrently, collapsing the possible errors
    TE.chainW(() => TE.traverseArray(fsFunctional.createDirIfNotExists)(viewPathsToWrite)),

    // write the view definitions in the directories just created, idempotently and concurrently, collapsing the possible errors
    TE.chainW(() => TE.traverseArray(fsFunctional.writeFile)(viewsFilesToWrite)),
  )

  // run the update views pipeline
  const updateDefinitionsInViewsDirEither = await updateDefinitionsInViewsDirPipeline()
  if (E.isLeft(updateDefinitionsInViewsDirEither)) {
    // success: no error happened while writing up in the views directory
    // failure: check which error to throw
    const error = match(updateDefinitionsInViewsDirEither.left)
      .with({ type: 'fs-create-dir' }, (e) => {
        throw new Error(`Error creating the directory: ${e.meta.dir}.\n${e.error}.`)
      })
      .with({ type: 'fs-write-file' }, (e) => {
        throw new Error(`Error writing the view definition\n${e.meta.content}\nto file ${e.meta.path}.\n${e.error}.`)
      })
      .exhaustive()

    throw error
  }

  // Remove empty subdirectories
  try {
    const subdirectoriesInViewsDir = await fsFunctional.getFoldersInDir(viewsDir)()
    subdirectoriesInViewsDir
      .filter((dir) => !viewPathsToWrite.includes(dir))
      .map(async (dir) => {
        // Delete SQL files in subdirectories
        ;(await fsFunctional.getFilesInDir(dir)())
          .filter((filename) => filename.endsWith('.sql'))
          .map(async (filename) => {
            await fsFunctional.removeFile(filename)()
          })

        // Check if subdirectory is empty and delete
        const contentWithoutGarbage = (await fsFunctional.getFilesInDir(dir)()).filter(
          (filename) => !isGarbageFile(filename),
        )
        if (contentWithoutGarbage.length === 0) {
          await fsFunctional.removeDir(dir)()
        }
      })
  } catch (e) {
    throw new Error(`Error while cleaning up the views directory.\n${e}`)
  }

  // Success: no error happened while writing & cleaning up the views directory
  return
}

/**
 * If we did not introspect some views
 * then the views directory can be deleted as it is no longer needed.
 **/
async function onNoIntrospectedViews(viewsDir: string) {
  // Remove empty subdirectories
  const subdirectoriesInViewsDir = await fsFunctional.getFoldersInDir(viewsDir)()
  subdirectoriesInViewsDir.map(async (dir) => {
    // Delete SQL files in subdirectories
    ;(await fsFunctional.getFilesInDir(dir)())
      .filter((filename) => filename.endsWith('.sql'))
      .map(async (filename) => {
        await fsFunctional.removeFile(filename)()
      })

    // Check if subdirectory is empty and delete
    const contentWithoutGarbage = (await fsFunctional.getFilesInDir(dir)()).filter(
      (filename) => !isGarbageFile(filename),
    )
    if (contentWithoutGarbage.length === 0) {
      await fsFunctional.removeDir(dir)()
    }
  })

  // Check if the views directory is empty
  const contentWithoutGarbage = (await fsFunctional.getFilesInDir(viewsDir)()).filter(
    (filename) => !isGarbageFile(filename),
  )
  if (contentWithoutGarbage.length > 0) {
    // We're keeping the views directory because it contains files
    return
  }

  // The views directory is empty, remove it
  const removeDirEither = await fsFunctional.removeDir(viewsDir)()
  if (E.isRight(removeDirEither)) {
    return
  }

  const error = match(removeDirEither.left).with({ type: 'fs-remove-dir' }, (e) => {
    throw new Error(`Error removing the directory: ${e.meta.dir}.\n${e.error}.`)
  })

  throw error
}
