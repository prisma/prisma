import { enginesVersion, getEnginesPath } from '@prisma/engines'
import { download } from '@prisma/fetch-engine'
import type { Platform } from '@prisma/get-platform'
import { getNodeAPIName } from '@prisma/get-platform'
import { ClientEngineType } from '@prisma/internals'
import fs from 'fs'
import path from 'path'
/**
 * Ensures the correct Query Engine (`node-api`/`binary`) is present. This is required as
 * normally the downloading of the required engine is done in `getGenerators`. As the test
 * clients bypass this we need to ensure the correct engine is present.
 * @param clientEngineType
 * @param platform
 */
export async function ensureTestClientQueryEngine(clientEngineType: ClientEngineType, platform: Platform) {
  const enginesPath = getEnginesPath()
  const queryEngineLibraryPath = path.join(enginesPath, getNodeAPIName(platform, 'fs'))
  const queryEngineBinaryPath = path.join(
    enginesPath,
    `query-engine-${platform}${platform === 'windows' ? '.exe' : ''}`,
  )

  if (clientEngineType === ClientEngineType.Library && !fs.existsSync(queryEngineLibraryPath)) {
    await download({
      binaries: {
        'libquery-engine': enginesPath,
      },
      version: enginesVersion,
    })
  } else if (clientEngineType === ClientEngineType.Binary && !fs.existsSync(queryEngineBinaryPath)) {
    await download({
      binaries: {
        'query-engine': enginesPath,
      },
      version: enginesVersion,
    })
  }
}
