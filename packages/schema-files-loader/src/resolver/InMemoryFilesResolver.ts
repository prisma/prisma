import { createFileNameToKeyMapper, type FileNameToKeyMapper } from './caseSensitivity'
import type { CaseSensitivityOptions, FilesResolver, FsEntryType } from './types'

type InMemoryNode = {
  /**
   * Original name of a file or directory, preserving the case used
   * in `addFile` regardless of case-sensitivity settings. Mostly
   * needed for nicer output of `listDirContents`
   */
  canonicalName: string
  content: string | InMemoryTree
}

type InMemoryTree = {
  [fileKey: string]: InMemoryNode
}

export class InMemoryFilesResolver implements FilesResolver {
  private _tree: InMemoryTree = {}
  private _fileNameToKey: FileNameToKeyMapper

  constructor(options: CaseSensitivityOptions) {
    this._fileNameToKey = createFileNameToKeyMapper(options)
  }

  addFile(absolutePath: string, content: string): void {
    const dirs = absolutePath.split(/[\\/]/)
    const fileName = dirs.pop()
    if (!fileName) {
      throw new Error('Path is empty')
    }
    let currentDirRecord = this._tree
    for (const dir of dirs) {
      const key = this._fileNameToKey(dir)
      let nextDirNode = currentDirRecord[key]
      if (!nextDirNode) {
        nextDirNode = {
          canonicalName: dir,
          content: {},
        }
        currentDirRecord[key] = nextDirNode
      }
      if (typeof nextDirNode.content === 'string') {
        throw new Error(`${dir} is a file`)
      }
      currentDirRecord = nextDirNode.content
    }

    if (typeof currentDirRecord[fileName]?.content === 'object') {
      throw new Error(`${absolutePath} is a directory`)
    }
    currentDirRecord[this._fileNameToKey(fileName)] = {
      canonicalName: fileName,
      content,
    }
  }

  private getInMemoryContent(absolutePath: string): InMemoryTree | string | undefined {
    const keys = absolutePath.split(/[\\/]/).map((fileName) => this._fileNameToKey(fileName))
    let currentRecord: InMemoryTree | string | undefined = this._tree
    for (const key of keys) {
      if (typeof currentRecord !== 'object') {
        return undefined
      }
      currentRecord = currentRecord[key]?.content
    }
    return currentRecord
  }

  listDirContents(filePath: string): Promise<string[]> {
    return Promise.resolve().then(() => {
      const dirContent = this.getInMemoryContent(filePath)
      if (typeof dirContent !== 'object') {
        return []
      }
      return Object.values(dirContent).map((node) => node.canonicalName)
    })
  }

  getEntryType(filePath: string): Promise<FsEntryType | undefined> {
    return Promise.resolve().then(() => {
      const entry = this.getInMemoryContent(filePath)
      if (typeof entry === 'string') {
        return { kind: 'file' }
      }
      if (typeof entry === 'object') {
        return { kind: 'directory' }
      }
      return undefined
    })
  }
  getFileContents(filePath: string): Promise<string | undefined> {
    return Promise.resolve().then(() => {
      const entry = this.getInMemoryContent(filePath)
      if (typeof entry === 'undefined') {
        return undefined
      }
      if (typeof entry === 'object') {
        throw new Error(`${filePath} is directory`)
      }
      return entry
    })
  }
}
