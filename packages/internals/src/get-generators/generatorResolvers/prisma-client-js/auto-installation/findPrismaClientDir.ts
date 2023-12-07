import Debug from '@prisma/debug'
import fs from 'fs'
import path from 'path'

import { resolvePkg } from '../check-dependencies/resolve'

const debug = Debug('prisma:generator')
const realPath = fs.promises.realpath

/**
 * Tries to find a `@prisma/client` that is next to the `prisma` CLI
 * @param baseDir from where to start looking from
 * @returns `@prisma/client` location
 */
export async function findPrismaClientDir(baseDir: string) {
  const resolveOpts = { basedir: baseDir, preserveSymlinks: true }
  const CLIDir = await resolvePkg('prisma', resolveOpts)
  const clientDir = await resolvePkg('@prisma/client', resolveOpts)
  const resolvedClientDir = clientDir && (await realPath(clientDir))

  debug('prismaCLIDir', CLIDir)
  debug('prismaClientDir', clientDir)

  // If CLI not found, we can only continue forward, likely a test
  if (CLIDir === undefined) return resolvedClientDir
  if (clientDir === undefined) return resolvedClientDir

  // for everything to work well we expect `../<client-dir>`
  const relDir = path.relative(CLIDir, clientDir).split(path.sep)

  // if the client is not near `prisma`, in parent folder => fail
  if (relDir[0] !== '..' || relDir[1] === '..') return undefined

  // we return the resolved location as pnpm users will want that
  return resolvedClientDir
}
