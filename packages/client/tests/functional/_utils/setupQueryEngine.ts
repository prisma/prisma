import { enginesVersion } from '@prisma/engines'
import { download } from '@prisma/fetch-engine'
import type { Platform } from '@prisma/get-platform'
import { getNodeAPIName } from '@prisma/get-platform'
import { ClientEngineType } from '@prisma/internals'
import fs from 'fs-extra'
import path from 'path'

/**
 * Ensures the correct Query Engine (`node-api`/`binary`) is present. This is required as
 * normally the downloading of the required engine is done in `getGenerators`. As the test
 * clients bypass this we need to ensure the correct engine is present.
 * @param clientEngineType
 * @param platform
 */
export async function setupQueryEngine(clientEngineType: ClientEngineType, platform: Platform) {
  const engineDownloadDir = path.join(__dirname, '..', '..', '..')
  const queryEngineLibraryPath = path.join(engineDownloadDir, getNodeAPIName(platform, 'fs'))
  const queryEngineBinaryPath = path.join(
    engineDownloadDir,
    `query-engine-${platform}${platform === 'windows' ? '.exe' : ''}`,
  )

  if (clientEngineType === ClientEngineType.Library && !(await fs.pathExists(queryEngineLibraryPath))) {
    await download({ engines: { 'libquery-engine': engineDownloadDir }, version: enginesVersion })
  } else if (clientEngineType === ClientEngineType.Binary && !(await fs.pathExists(queryEngineBinaryPath))) {
    await download({ engines: { 'query-engine': engineDownloadDir }, version: enginesVersion })
  }
}

// TODO this might be duplicated in a few places, find a common place
