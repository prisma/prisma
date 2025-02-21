import path from 'node:path'

// This function ensures that PSL errors pointing to an absolute schema path
// display a relative path (w.r.t. the current working directory) instead.
// This can potentially be replaced by https://github.com/prisma/team-orm/issues/1127.
export function relativizePathInPSLError(error: string): string {
  return error.replaceAll(process.cwd() + path.sep, '')
}
