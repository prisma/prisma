/* eslint-disable @typescript-eslint/no-inferrable-types */
import fs from 'fs'
import path from 'path'

const readdir = fs.promises.readdir

/**
 * Transform a dirent to a file type
 * @param dirent
 * @returns
 */
const direntToType = (dirent: fs.Dirent) => {
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
    } else
    if (regex.exec(string)) {
      return true
    }
  }

  return false
}

/**
 * Find paths that match a set of regexes.
 * (cannot follow links at the moment)
 * @param root to start from
 * @param match to match against
 * @param types to select files, folders, links
 * @param deep to recurse in the directory tree
 * @param limit to limit the results
 * @param found to add already found
 * @returns
 */
export const findSync = (
  root: string,
  match: (RegExp | string)[],
  types: ('f' | 'd' | 'l')[] = ['f', 'd', 'l'],
  deep: boolean = false,
  limit: number = Infinity,
  found: string[] = [],
) => {
  // we stop if we found enough results
  if (limit - found.length <= 0) {
    return found
  }

  // we list the items in the current root
  const items = fs.readdirSync(root, { withFileTypes: true })

  for (const item of items) {
    // we get the file type of each item
    const itemType = direntToType(item)

    // if the ietm is one of the selected
    if (itemType && types.includes(itemType)) {
      const itemPath = path.join(root, item.name)

      // we match the item's path to our regexes
      if (isMatched(itemPath, match)) {
        found.push(itemPath) // mutate is easier
      }
    }

    // we deep dive within the directory tree
    if (deep && itemType === 'd') {
      const subRoot = path.join(root, item.name)

      // we recurse and continue mutating `found`
      findSync(subRoot, match, types, deep, limit, found)
    }
  }

  return found
}
