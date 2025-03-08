import type { LoadedFile } from './loadSchemaFiles'

export type GetSchemaResult = {
  /**
   * A path from which schema was loaded.
   * Can be either folder or a single file
   */
  schemaPath: string
  /**
   * Base dir for all of the schema files.
   * In-multi file mode, this is equal to `schemaPath`.
   * In single-file mode, this is a parent directory of
   * a file
   */
  schemaRootDir: string
  /**
   * All loaded schema files
   */
  schemas: Array<LoadedFile>
}

export type PathType = 'file' | 'directory'

export type SuccessfulLookupResult = {
  ok: true
  schema: GetSchemaResult
}

/// Non fatal error does not cause
/// abort of the lookup process and usually
/// means we should try next option. It will be turned into exception
/// only if all options are exhausted
export type NonFatalLookupError =
  | {
      kind: 'NotFound'
      expectedType?: PathType
      path: string
    }
  | {
      kind: 'WrongType'
      path: string
      expectedTypes: PathType[]
    }
  | {
      kind: 'FolderPreviewNotEnabled'
      path: string
    }

export type LookupResult =
  | SuccessfulLookupResult
  | {
      ok: false
      error: NonFatalLookupError
    }
