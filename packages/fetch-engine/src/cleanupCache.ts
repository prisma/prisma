import Debug from '@prisma/debug'
import fs from 'fs'
import pMap from 'p-map'
import path from 'path'
import rimraf from 'rimraf'
import { promisify } from 'util'

import { getRootCacheDir } from './util'

const debug = Debug('cleanupCache')
const del = promisify(rimraf)
const readdir = promisify(fs.readdir)
const stat = promisify(fs.stat)

// TODO: why not have a n = 2 to have a smaller cache?
export async function cleanupCache(n = 5): Promise<void> {
  try {
    const rootCacheDir = await getRootCacheDir()
    if (!rootCacheDir) {
      debug('no rootCacheDir found')
      return
    }
    const channel = 'master'
    const cacheDir = path.join(rootCacheDir, channel)
    const dirs = await readdir(cacheDir)
    const dirsWithMeta = await Promise.all(
      dirs.map(async (dirName) => {
        const dir = path.join(cacheDir, dirName)
        const statResult = await stat(dir)

        return {
          dir,
          created: statResult.birthtime,
        }
      }),
    )
    dirsWithMeta.sort((a, b) => (a.created < b.created ? 1 : -1))
    const dirsToRemove = dirsWithMeta.slice(n)
    await pMap(dirsToRemove, (dir) => del(dir.dir), { concurrency: 20 })
  } catch (e) {
    // fail silently
  }
}
