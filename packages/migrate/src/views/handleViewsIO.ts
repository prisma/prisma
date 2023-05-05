import { fsFunctional } from '@prisma/internals'
import * as E from 'fp-ts/lib/Either'
import { pipe } from 'fp-ts/lib/function'
import * as T from 'fp-ts/lib/Task'
import * as TE from 'fp-ts/lib/TaskEither'
import path from 'path'
import { match } from 'ts-pattern'

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
 * If some other files or folders exist within the `views` directory, the CLI must remove them.
 * These files and folders are deleted silently.
 */
export async function handleViewsIO({ views, schemaPath }: HandleViewsIOParams): Promise<void> {
  const prismaDir = path.dirname(fsFunctional.normalizePossiblyWindowsDir(schemaPath))
  const viewsDir = path.posix.join(prismaDir, 'views')

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

    // remove any view directories related to schemas that no longer exist, concurrently, collapsing the possible errors
    TE.chainW(() =>
      pipe(
        fsFunctional.getFoldersInDir(viewsDir),
        T.chain((directoriesInViewsDir) => {
          const viewDirsToRemove = directoriesInViewsDir.filter((dir) => !viewPathsToWrite.includes(dir))
          return TE.traverseArray(fsFunctional.removeDir)(viewDirsToRemove)
        }),
      ),
    ),

    // remove any other files in the views directory beyond the ones just created, concurrently, collapsing the possible errors
    TE.chainW(() =>
      pipe(
        fsFunctional.getFilesInDir(viewsDir),
        T.chain((filesInViewsDir) => {
          const viewFilesToKeep = viewsFilesToWrite.map(({ path }) => path)
          const viewFilesToRemove = filesInViewsDir.filter((file) => !viewFilesToKeep.includes(file))
          return TE.traverseArray(fsFunctional.removeFile)(viewFilesToRemove)
        }),
      ),
    ),
  )

  // run the fs views pipeline
  const updateDefinitionsInViewsDirEither = await updateDefinitionsInViewsDirPipeline()

  if (E.isRight(updateDefinitionsInViewsDirEither)) {
    // success: no error happened while writing and cleaning up the views directory
    return
  }

  // failure: check which error to throw
  const error = match(updateDefinitionsInViewsDirEither.left)
    .with({ type: 'fs-create-dir' }, (e) => {
      throw new Error(`Error creating the directory: ${e.meta.dir}.\n${e.error}.`)
    })
    .with({ type: 'fs-write-file' }, (e) => {
      throw new Error(`Error writing the view definition\n${e.meta.content}\nto file ${e.meta.path}.\n${e.error}.`)
    })
    .with({ type: 'fs-remove-dir' }, (e) => {
      throw new Error(`Error removing the directory: ${e.meta.dir}.\n${e.error}.`)
    })
    .with({ type: 'fs-remove-file' }, (e) => {
      throw new Error(`Error removing the file: ${e.meta.filePath}.\n${e.error}.`)
    })
    .exhaustive()

  throw error
}
