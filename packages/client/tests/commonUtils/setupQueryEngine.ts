import { enginesVersion } from '@prisma/engines'
import { download } from '@prisma/fetch-engine'
import path from 'path'

/**
 * Ensures the correct Query Engine (`node-api`/`binary`) is present. This is required as
 * normally the downloading of the required engine is done in `getGenerators`. As the test
 * clients bypass this we need to ensure the correct engine is present.
 */
export function setupQueryEngine() {
  const engineDownloadDir = path.resolve(__dirname, '..', '..')

  return download({
    binaries: {
      'libquery-engine': engineDownloadDir,
      'query-engine': engineDownloadDir,
    },
    version: enginesVersion,
  })
}

// TODO this might be duplicated in a few places, find a common place
