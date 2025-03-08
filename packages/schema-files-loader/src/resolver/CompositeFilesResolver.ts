import { createFileNameToKeyMapper, type FileNameToKeyMapper } from './caseSensitivity'
import type { CaseSensitivityOptions, FilesResolver, FsEntryType } from './types'

/**
 * Files resolver that combines two other resolvers
 * together. Files existing in either one of those will be
 * reported. If content exist in both, primary resolver takes
 * precedence
 */
export class CompositeFilesResolver implements FilesResolver {
  private _fileNameToKey: FileNameToKeyMapper
  constructor(
    private primary: FilesResolver,
    private secondary: FilesResolver,
    options: CaseSensitivityOptions,
  ) {
    this._fileNameToKey = createFileNameToKeyMapper(options)
  }

  async listDirContents(path: string): Promise<string[]> {
    const primaryContent = await this.primary.listDirContents(path)
    const secondaryContent = await this.secondary.listDirContents(path)

    return uniqueWith([...primaryContent, ...secondaryContent], this._fileNameToKey)
  }

  async getEntryType(path: string): Promise<FsEntryType | undefined> {
    return (await this.primary.getEntryType(path)) ?? (await this.secondary.getEntryType(path))
  }

  async getFileContents(path: string): Promise<string | undefined> {
    return (await this.primary.getFileContents(path)) ?? (await this.secondary.getFileContents(path))
  }
}

function uniqueWith(fileNames: string[], toKey: FileNameToKeyMapper): string[] {
  const map = new Map<string, string>()
  for (const fileName of fileNames) {
    const key = toKey(fileName)
    if (!map.has(key)) {
      map.set(key, fileName)
    }
  }
  return Array.from(map.values())
}
