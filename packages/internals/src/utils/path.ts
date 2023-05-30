import path from 'path'

/**
 * Normalize `filePath` to use forward slashes as a separator. `filePath` is
 * treated as a path specific to the current platform, so backslashes will only
 * be replaced with forward slashes on Windows. On other platforms, where a
 * backslash is a valid filename character, it will be treated as such and will
 * not be replaced.
 */
export function pathToPosix(filePath: string): string {
  if (path.sep === path.posix.sep) {
    return filePath
  }
  return filePath.split(path.sep).join(path.posix.sep)
}
