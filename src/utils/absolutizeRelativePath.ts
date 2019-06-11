import { URL } from 'url'
import path from 'path'

export function absolutizeRelativePath(filePath: string, cwd: string): string {
  const url = new URL(filePath)
  if (url.protocol !== 'file:') {
    return filePath
  }

  const joined = path.join(cwd, url.hostname)
  return `file:/${joined}`
}
