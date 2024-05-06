import { FilesResolver, FsEntryType } from './types'

/**
 * Files resolver that combines two other resolvers
 * together. Files existing in either one of those will be
 * reported. Content existing in
 */
export class CompositeFilesResolver implements FilesResolver {
  constructor(private primary: FilesResolver, private secondary: FilesResolver) {}

  async listDirContents(path: string): Promise<string[]> {
    const primaryContent = await this.primary.listDirContents(path)
    const secondaryContent = await this.secondary.listDirContents(path)

    return unique([...primaryContent, ...secondaryContent])
  }

  async getEntryType(path: string): Promise<FsEntryType | undefined> {
    return (await this.primary.getEntryType(path)) ?? (await this.secondary.getEntryType(path))
  }

  async getFileContents(path: string): Promise<string | undefined> {
    return (await this.primary.getFileContents(path)) ?? (await this.secondary.getFileContents(path))
  }
}

function unique<T>(array: T[]): T[] {
  return [...new Set(array)]
}
