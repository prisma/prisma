/* eslint-disable @typescript-eslint/no-inferrable-types */
import fs from 'fs'
import path from 'path'

const readdirAsync = fs.promises.readdir
const realpathAsync = fs.promises.realpath
const statAsync = fs.promises.stat

const readdirSync = fs.readdirSync
const realpathSync = fs.realpathSync
const statSync = fs.statSync

/**
 * Transform a dirent to a file type
 * @param dirent
 * @returns
 */
const direntToType = (dirent: fs.Dirent | fs.Stats) => {
  return dirent.isFile()
    ? 'f'
    : dirent.isDirectory()
    ? 'd'
    : dirent.isSymbolicLink()
    ? 'l'
    : undefined
}

/**
 * Is true if at least one matched
 * @param string to match aigainst
 * @param regexs to be matched with
 * @returns
 */
const isMatched = (string: string, regexs: (RegExp | string)[]) => {
  for (const regex of regexs) {
    if (typeof regex === 'string') {
      if (string.includes(regex)) {
        return true
      }
    } else if (regex.exec(string)) {
      return true
    }
  }

  return false
}

/**
 * Find paths that match a set of regexes
 * @param root to start from
 * @param match to match against
 * @param types to select files, folders, links
 * @param deep to recurse in the directory tree
 * @param limit to limit the results
 * @param filter to further filter results
 * @param found to add to already found #private
 * @param seen to add to already seen #private
 * @returns unresolved paths
 */
export const findSync = (
  root: string,
  match: (RegExp | string)[],
  types: ('f' | 'd' | 'l')[] = ['f', 'd', 'l'],
  deep: boolean = false,
  limit: number = Infinity,
  filter: (base: string, item: string) => boolean | string = () => true,
  found: string[] = [],
  seen: Record<string, true> = {},
) => {
  try {
    const realRoot = realpathSync(root)

    // we make sure not to loop infinitely
    if (seen[realRoot]) {
      return found
    }

    // we stop if we found enough results
    if (limit - found.length <= 0) {
      return found
    }

    // we check that the root is a directory
    if (direntToType(statSync(realRoot)) !== 'd') {
      return found
    }

    // we list the items in the current root
    const items = readdirSync(root, { withFileTypes: true })

    seen[realRoot] = true
    for (const item of items) {
      // we get the file info for each item
      const itemType = direntToType(item)
      const itemPath = path.join(root, item.name)

      // if the ietm is one of the selected
      if (itemType && types.includes(itemType)) {
        // if the path of an item has matched
        if (isMatched(itemPath, match)) {
          const value = filter(root, item.name)

          // if we changed the path value
          if (typeof value === 'string') {
            found.push(value)
          }
          // if we kept the default path
          else if (value === true) {
            found.push(itemPath)
          }
        }
      }

      // we deep dive within the directory tree
      if (deep && ['d', 'l'].includes(itemType!)) {
        // we recurse and continue mutating `found`
        findSync(itemPath, match, types, deep, limit, filter, found, seen)
      }
    }
  } catch {}

  return found
}

/**
 * Like `findSync` but moves to the parent folder if nothing is found
 * @param root to start from
 * @param match to match against
 * @param types to select files, folders, links
 * @param deep to recurse in the directory tree
 * @param limit to limit the results
 * @param filter to further filter results
 * @param found to add to already found #private
 * @param seen to add to already seen #private
 * @returns unresolved paths
 */
export const findUpSync = (
  root: string,
  match: (RegExp | string)[],
  types: ('f' | 'd' | 'l')[] = ['f', 'd', 'l'],
  deep: boolean = false,
  limit: number = Infinity,
  filter: (base: string, item: string) => boolean | string = () => true,
  found: string[] = [],
  seen: Record<string, true> = {},
) => {
  // stop if we cannot go any higher than this root
  if (path.resolve(root) === path.resolve(root, '..')) {
    return found
  }

  findSync(root, match, types, deep, limit, filter, found, seen)

  if (found.length === 0) {
    const parent = path.join(root, '..')

    findUpSync(parent, match, types, deep, limit, filter, found, seen)
  }

  return found
}

/**
 * Find paths that match a set of regexes
 * @param root to start from
 * @param match to match against
 * @param types to select files, folders, links
 * @param deep to recurse in the directory tree
 * @param limit to limit the results
 * @param filter to further filter results
 * @param found to add to already found #private
 * @param seen to add to already seen #private
 * @returns unresolved paths
 */
export const findAsync = async (
  root: string,
  match: (RegExp | string)[],
  types: ('f' | 'd' | 'l')[] = ['f', 'd', 'l'],
  deep: boolean = false,
  limit: number = Infinity,
  filter: (base: string, item: string) => boolean | string = () => true,
  found: string[] = [],
  seen: Record<string, true> = {},
) => {
  try {
    const realRoot = await realpathAsync(root)

    // we make sure not to loop infinitely
    if (seen[realRoot]) {
      return found
    }

    // we stop if we found enough results
    if (limit - found.length <= 0) {
      return found
    }

    // we check that the root is a directory
    if (direntToType(await statAsync(realRoot)) !== 'd') {
      return found
    }

    // we list the items in the current root
    const items = await readdirAsync(root, { withFileTypes: true })

    seen[realRoot] = true
    for (const item of items) {
      // we get the file info for each item
      const itemType = direntToType(item)
      const itemPath = path.join(root, item.name)

      // if the ietm is one of the selected
      if (itemType && types.includes(itemType)) {
        // if the path of an item has matched
        if (isMatched(itemPath, match)) {
          const value = filter(root, item.name)

          // if we changed the path value
          if (typeof value === 'string') {
            found.push(value)
          }
          // if we kept the default path
          else if (value === true) {
            found.push(itemPath)
          }
        }
      }

      // we deep dive within the directory tree
      if (deep && ['d', 'l'].includes(itemType!)) {
        // we recurse and continue mutating `found`
        // eslint-disable-next-line prettier/prettier
        await findAsync(
          itemPath,
          match,
          types,
          deep,
          limit,
          filter,
          found,
          seen,
        )
      }
    }
  } catch {}

  return found
}

/**
 * Like `findSync` but moves to the parent folder if nothing is found
 * @param root to start from
 * @param match to match against
 * @param types to select files, folders, links
 * @param deep to recurse in the directory tree
 * @param limit to limit the results
 * @param filter to further filter results
 * @param found to add to already found #private
 * @param seen to add to already seen #private
 * @returns unresolved paths
 */
export const findUpAsync = async (
  root: string,
  match: (RegExp | string)[],
  types: ('f' | 'd' | 'l')[] = ['f', 'd', 'l'],
  deep: boolean = false,
  limit: number = Infinity,
  filter: (base: string, item: string) => boolean | string = () => true,
  found: string[] = [],
  seen: Record<string, true> = {},
) => {
  // stop if we cannot go any higher than this root
  if (path.resolve(root) === path.resolve(root, '..')) {
    return found
  }

  await findAsync(root, match, types, deep, limit, filter, found, seen)

  if (found.length === 0) {
    const parent = path.join(root, '..')

    await findUpAsync(parent, match, types, deep, limit, filter, found, seen)
  }

  return found
}
