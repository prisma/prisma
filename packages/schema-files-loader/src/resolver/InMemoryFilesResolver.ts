import path from 'node:path'

import { FilesResolver, FsEntryType } from './types'

type InMemoryTree = {
  [path: string]: string | InMemoryTree
}

export class InMemoryFilesResolver implements FilesResolver {
  private _tree: InMemoryTree = {}

  addFile(absolutePath: string, content: string): void {
    const dirs = absolutePath.split(path.sep)
    const fileName = dirs.pop()
    if (!fileName) {
      throw new Error(`Path is empty`)
    }
    let currentDirRecord = this._tree
    for (const dir of dirs) {
      let nextDirRecord = currentDirRecord[dir]
      if (!nextDirRecord) {
        nextDirRecord = {}
        currentDirRecord[dir] = nextDirRecord
      }
      if (typeof nextDirRecord === 'string') {
        throw new Error(`${dir} is a file`)
      }
      currentDirRecord = nextDirRecord
    }

    if (typeof currentDirRecord[fileName] === 'object') {
      throw new Error(`${absolutePath} is a directory`)
    }
    currentDirRecord[fileName] = content
  }

  private getInMemoryContent(absolutePath: string): InMemoryTree | string | undefined {
    const parts = absolutePath.split(path.sep)
    let currentRecord: InMemoryTree | string | undefined = this._tree
    for (const part of parts) {
      if (typeof currentRecord !== 'object') {
        return undefined
      }
      currentRecord = currentRecord[part]
    }
    return currentRecord
  }

  listDirContents(filePath: string): Promise<string[]> {
    return Promise.resolve().then(() => {
      const dirContent = this.getInMemoryContent(filePath)
      if (typeof dirContent !== 'object') {
        return []
      }
      return Object.keys(dirContent)
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
