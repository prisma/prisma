import { fsFunctional, fsUtils } from '@prisma/internals'
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
 * If some other non ".sql" files or folders exist within the `views` directory, the CLI must preserve them.
 * In case of empty folders, these are deleted silently.
 */
export async function handleViewsIO({ views, schemaPath }: HandleViewsIOParams): Promise<void> {
  const prismaDir = path.dirname(fsUtils.normalizePossiblyWindowsDir(schemaPath))
  const viewsDir = path.posix.join(prismaDir, 'views')

  if (views.length === 0) {
    await cleanLeftoversIO(viewsDir)
    return
  }

  const { viewFilesToKeep } = await createViewsIO(viewsDir, views)
  await cleanLeftoversIO(viewsDir, viewFilesToKeep)
}

async function createViewsIO(
  viewsDir: string,
  views: IntrospectionViewDefinition[],
): Promise<{ viewFilesToKeep: string[] }> {
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

  const viewFilesToKeep = viewsFilesToWrite.map(({ path }) => path)

  const pipeline = pipe(
    // create the views directory, idempotently
    fsFunctional.createDirIfNotExists(viewsDir),

    // create the view directories, idempotently and concurrently, collapsing the possible errors
    TE.chainW(() => TE.traverseArray(fsFunctional.createDirIfNotExists)(viewPathsToWrite)),

    // write the view definitions in the directories just created, idempotently and concurrently, collapsing the possible errors
    TE.chainW(() => TE.traverseArray(fsFunctional.writeFile)(viewsFilesToWrite)),
  )

  const either = await pipeline()

  if (E.isRight(either)) {
    return { viewFilesToKeep }
  }

  // failure: check which error to throw
  const error = match(either.left)
    .with({ type: 'fs-create-dir' }, (e) => {
      throw new Error(`Error creating the directory: ${e.meta.dir}.\n${e.error}.`)
    })
    .with({ type: 'fs-write-file' }, (e) => {
      throw new Error(`Error writing the view definition\n${e.meta.content}\nto file ${e.meta.path}.\n${e.error}.`)
    })
    .exhaustive()

  throw error
}

/**
 * - Delete every *.sql file in the subfolders of viewsDir
 * - Delete any empty subfolders
 * - Delete viewsDir if it is empty
 */
async function cleanLeftoversIO(viewsDir: string, viewFilesToKeep: string[] = []): Promise<void> {
  const pipeline = pipe(
    // remove any SQL files in the views directory beyond the ones just created, concurrently, collapsing the possible errors
    fsFunctional.getFilesInDir(viewsDir, '**/*/*.sql'),
    T.chain((filesInViewsDir) => {
      const viewFilesToRemove = filesInViewsDir.filter((file) => !viewFilesToKeep.includes(file))
      return TE.traverseArray(fsFunctional.removeFile)(viewFilesToRemove)
    }),

    // remove any empty directories in the views directory, recursively
    TE.chainW(() => fsFunctional.removeEmptyDirs(viewsDir)),
  )

  const either = await pipeline()

  if (E.isRight(either)) {
    return
  }

  // failure: check which error to throw
  const error = match(either.left)
    .with({ type: 'fs-remove-empty-dirs' }, (e) => {
      throw new Error(`Error removing empty directories in: ${e.meta.dir}.\n${e.error}.`)
    })
    .with({ type: 'fs-remove-file' }, (e) => {
      throw new Error(`Error removing the file: ${e.meta.filePath}.\n${e.error}.`)
    })
    .exhaustive()
  // We execute the cleanup and ignore the possible errors
  await pipeline()

  throw error
}
