import fs from 'node:fs/promises'

import type { NonFatalLookupError, PathType } from '../types'

export async function ensureType(entryPath: string, expectedType: PathType): Promise<NonFatalLookupError | undefined> {
  try {
    const pathStat = await fs.stat(entryPath)
    if (expectedType === 'file' && pathStat.isFile()) {
      return undefined
    }

    if (expectedType === 'directory' && pathStat.isDirectory()) {
      return undefined
    }

    return { kind: 'WrongType', path: entryPath, expectedTypes: [expectedType] }
  } catch (e) {
    if (e.code === 'ENOENT') {
      return { kind: 'NotFound', path: entryPath, expectedType }
    }
    throw e
  }
}
