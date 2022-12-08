/* eslint-disable @typescript-eslint/no-inferrable-types */
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const readdirAsync = promisify(fs.readdir)
const realpathAsync = promisify(fs.realpath)
const statAsync = promisify(fs.stat)

const readdirSync = fs.readdirSync
const realpathSync = fs.realpathSync
const statSync = fs.statSync

type ItemType = 'd' | 'f' | 'l'
type Handler = (base: string, item: string, type: ItemType) => boolean | string

/**
 * Transform a dirent to a file type
 * @param dirent
 * @returns
 */
function direntToType(dirent: fs.Dirent | fs.Stats) {
  return dirent.isFile() ? 'f' : dirent.isDirectory() ? 'd' : dirent.isSymbolicLink() ? 'l' : undefined
}

/**
 * Is true if at least one matched
 * @param string to match against
 * @param regexs to be matched with
 * @returns
 */
function isMatched(string: string, regexs: (RegExp | string)[]) {
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
 * 
 * The search is done breadth-first to have a bias towards shorter paths.
 *
 * @param root to start from
 * @param match to match against
 * @param types to select files, folders, links
 * @param deep to recurse in the directory tree
 * @param limit to limit the results
 * @param handler to further filter results
 * @param found to add to already found
 * @param seen to add to already seen
 * @returns found paths (symlinks preserved)
 */
export function findSync(
  root: string,
  match: (RegExp | string)[],
  types: ('f' | 'd' | 'l')[] = ['f', 'd', 'l'],
  deep: ('d' | 'l')[] = [],
  limit: number = Infinity,
  handler: Handler = () => true,
  found: string[] = [],
  seen: Record<string, true> = {},
) {
  try {
    const realRoot = realpathSync(root)

    // we check that the root is a directory
    if (direntToType(statSync(realRoot)) !== 'd') {
      return found
    }
    
    // we list the items in the search root
    const items = readdirSync(realRoot, { withFileTypes: true });
    let stack = [...items.map((i) => ({ item: i, dir: root }))];
    
    while (true) {
      // We stop if the search is complete
      if (stack.length == 0){
        return found;
      }

      // we stop if we found enough results
      if (limit - found.length <= 0) {
        return found;
      }
      
      const { item, dir } = stack.shift();
      const itemName = item.name;
      const itemType = direntToType(item);
      const itemPath = path.join(dir, itemName)
      
      const realItemPath = realpathSync(itemPath)

      // we make sure not to loop infinitely
      if (seen[realItemPath]) {
        continue;
      }
      
      seen[realItemPath] = true;
      
      if (itemType && types.includes(itemType)) {
        // if the path of an item has matched
        if (isMatched(itemPath, match)) {
          const value = handler(dir, itemName, itemType)

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

      // dive within the directory tree
      if (deep.includes(itemType)) {
        // If link doesn't point to a directory, continue
        if (direntToType(statSync(realItemPath)) !== 'd') {
          continue
        }	    
        
        // Push contents of directory to the end of the stack
        stack.push(
          ...readdirSync(itemPath, { withFileTypes: true }).map((i) => ({
            item: i,
            dir: itemPath,
          }))
        );
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
 * @param found to add to already found
 * @param seen to add to already seen
 * @returns found paths (symlinks preserved)
 */
export function findUpSync(
  root: string,
  match: (RegExp | string)[],
  types: ('f' | 'd' | 'l')[] = ['f', 'd', 'l'],
  deep: ('d' | 'l')[] = [],
  limit: number = Infinity,
  handler: Handler = () => true,
  found: string[] = [],
  seen: Record<string, true> = {},
) {
  // stop if we cannot go any higher than this root
  if (path.resolve(root) === path.resolve(root, '..')) {
    return found
  }

  findSync(root, match, types, deep, limit, handler, found, seen)

  if (found.length === 0) {
    const parent = path.join(root, '..')

    findUpSync(parent, match, types, deep, limit, handler, found, seen)
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
 * @param found to add to already found
 * @param seen to add to already seen
 * @returns found paths (symlinks preserved)
 */
export async function findAsync(
  root: string,
  match: (RegExp | string)[],
  types: ('f' | 'd' | 'l')[] = ['f', 'd', 'l'],
  deep: ('d' | 'l')[] = [],
  limit: number = Infinity,
  handler: Handler = () => true,
  found: string[] = [],
  seen: Record<string, true> = {},
) {
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
      const itemName = item.name
      const itemType = direntToType(item)
      const itemPath = path.join(root, item.name)

      // if the item is one of the selected
      if (itemType && types.includes(itemType)) {
        // if the path of an item has matched
        if (isMatched(itemPath, match)) {
          const value = handler(root, itemName, itemType)

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

      // dive within the directory tree
      if (deep.includes(itemType as any)) {
        // we recurse and continue mutating `found`
        await findAsync(itemPath, match, types, deep, limit, handler, found, seen)
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
 * @param found to add to already found
 * @param seen to add to already seen
 * @returns found paths (symlinks preserved)
 */
export async function findUpAsync(
  root: string,
  match: (RegExp | string)[],
  types: ('f' | 'd' | 'l')[] = ['f', 'd', 'l'],
  deep: ('d' | 'l')[] = [],
  limit: number = Infinity,
  handler: Handler = () => true,
  found: string[] = [],
  seen: Record<string, true> = {},
) {
  // stop if we cannot go any higher than this root
  if (path.resolve(root) === path.resolve(root, '..')) {
    return found
  }

  await findAsync(root, match, types, deep, limit, handler, found, seen)

  if (found.length === 0) {
    const parent = path.join(root, '..')

    await findUpAsync(parent, match, types, deep, limit, handler, found, seen)
  }

  return found
}
