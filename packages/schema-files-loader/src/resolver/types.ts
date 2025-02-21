export type FsEntryType =
  | {
      kind: 'file'
    }
  | {
      kind: 'directory'
    }
  | {
      kind: 'symlink'
      realPath: string
    }
  | { kind: 'other' }

export interface FilesResolver {
  listDirContents(path: string): Promise<string[]>

  getEntryType(path: string): Promise<FsEntryType | undefined>

  getFileContents(path: string): Promise<string | undefined>
}

export type CaseSensitivityOptions = {
  caseSensitive: boolean
}
