import { enginesVersion } from '@prisma/engines'
import { download } from '@prisma/fetch-engine'
import { ClientEngineType } from '@prisma/internals'
import path from 'path'

/**
 * Ensures the correct Query Engine (`node-api`/`binary`) is present. This is required as
 * normally the downloading of the required engine is done in `getGenerators`. As the test
 * clients bypass this we need to ensure the correct engine is present.
 * @param clientEngineType
 */
export async function setupQueryEngine(clientEngineType: ClientEngineType) {
  const engineDownloadDir = path.join(__dirname, '..', '..', '..')

  if (clientEngineType === ClientEngineType.Library) {
    await download({
      binaries: { 'libquery-engine': engineDownloadDir },
      version: enginesVersion,
    })
  } else if (clientEngineType === ClientEngineType.Binary) {
    await download({
      binaries: { 'query-engine': engineDownloadDir },
      version: enginesVersion,
    })
  }
}

// TODO this might be duplicated in a few places, find a common place
