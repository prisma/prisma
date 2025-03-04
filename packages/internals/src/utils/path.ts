import path from 'node:path'

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

/**
 * Returns the longest common path ancestor of the two paths (which may also be equal to one or both of them).
 * If they don't share a common ancestor (which may be the case on Windows if both paths are on different disks),
 * returns `undefined`.
 */
export function longestCommonPathPrefix(pathA: string, pathB: string): string | undefined {
  if (!path.isAbsolute(pathA) || !path.isAbsolute(pathB)) {
    throw new Error('longestCommonPathPrefix expects absolute paths')
  }

  if (process.platform === 'win32' && (pathA.startsWith('\\\\') || pathB.startsWith('\\\\'))) {
    // Make both paths namespaced if at least one of them is.
    pathA = path.toNamespacedPath(pathA)
    pathB = path.toNamespacedPath(pathB)
  }

  const commonPrefix = longestCommonPrefix(pathA.split(path.sep), pathB.split(path.sep)).join(path.sep)

  if (commonPrefix === '') {
    return process.platform === 'win32' ? undefined : '/'
  }

  if (process.platform === 'win32' && ['\\', '\\\\?', '\\\\.'].includes(commonPrefix)) {
    return undefined
  }

  if (process.platform === 'win32' && commonPrefix.endsWith(':')) {
    // Disk specifier without a backslash at the end is not an absolute path on windows,
    // it refers to current working directory on that disk.
    return `${commonPrefix}\\`
  }

  return commonPrefix
}

function longestCommonPrefix<T>(sequenceA: T[], sequenceB: T[]): T[] {
  const maxLen = Math.min(sequenceA.length, sequenceB.length)
  let sliceLen = 0

  while (sliceLen <= maxLen && sequenceA[sliceLen] === sequenceB[sliceLen]) {
    sliceLen++
  }

  return sequenceA.slice(0, sliceLen)
}
