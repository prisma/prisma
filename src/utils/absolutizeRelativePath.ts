import { URL } from 'url'
import path from 'path'

export function absolutizeRelativePath(filePath: string, cwd: string): string {
  const url = new URL(filePath)
  if (url.protocol !== 'file:') {
    return filePath
  }
  const prefix = 'file:'
  let restPath = filePath.slice(prefix.length)

  if (restPath[0] === '/' && restPath[1] === '/') {
    restPath = restPath.slice(1)
  }

  if (restPath.startsWith('/')) {
    return `file:/${restPath}`
  }

  const joined = path.join(cwd, restPath)
  return `file:/${joined}`
}
