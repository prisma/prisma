import path from 'path'

/**
 * Normalize a path using Node's `path` module.
 * @param pathToNormalize The path to normalize
 * @returns The normalized path
 */
export function normalizePath(pathToNormalize: string) {
  return path.normalize(pathToNormalize)
}
