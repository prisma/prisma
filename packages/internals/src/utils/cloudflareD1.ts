import path from 'node:path'
import process from 'node:process'

import { convertPathToPattern } from 'fast-glob'
import glob from 'globby'
import { match } from 'ts-pattern'

const defaultD1DirPath = path.join('.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject')

type TocateLocalCloudflareD1Args = {
  arg: '--to-local-d1' | '--from-local-d1'
}

// Utility to find the location of the local Cloudflare D1 sqlite database.
// When using `wrangler`, the database is located in `${cwd}/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<UUID>.sqlite`,
// where `<UUID>` is a unique identifier for the database.
export async function locateLocalCloudflareD1({ arg }: TocateLocalCloudflareD1Args) {
  const cwd = process.cwd()
  const d1DirPath = path.posix.join(cwd, defaultD1DirPath)
  const pathConverted = convertPathToPattern(d1DirPath)
  const d1Databases = await glob(path.posix.join(pathConverted, '*.sqlite'), {})

  if (d1Databases.length === 0) {
    throw new Error(
      `No Cloudflare D1 databases found in ${defaultD1DirPath}. Did you run \`wrangler d1 create <DATABASE_NAME>\` and \`wrangler dev\`?`,
    )
  }

  if (d1Databases.length > 1) {
    const { originalArg, recommendedArg } = match(arg)
      .with('--to-local-d1', (originalArg) => ({
        originalArg,
        recommendedArg: '--to-url file:',
      }))
      .with('--from-local-d1', (originalArg) => ({
        originalArg,
        recommendedArg: '--from-url file:',
      }))
      .exhaustive()

    throw new Error(
      `Multiple Cloudflare D1 databases found in ${defaultD1DirPath}. Please manually specify the local D1 database with \`${recommendedArg}\`, without using the \`${originalArg}\` flag.`,
    )
  }

  const d1Database = d1Databases[0]
  return d1Database
}
