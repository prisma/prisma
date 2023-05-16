import { getCliQueryEngineBinaryType } from '@prisma/engines'
import { BinaryType } from '@prisma/fetch-engine'
import { assertNodeAPISupported, getPlatformWithOSResult } from '@prisma/get-platform'
import execa from 'execa'
import * as TE from 'fp-ts/TaskEither'

import { resolveBinary } from '../resolveBinary'
import { loadLibrary } from '../utils/load'

type NodeAPILibrary = {
  version(): { commit: string }
}

export async function getEngineVersion(enginePath?: string, binaryName?: BinaryType): Promise<string> {
  if (!binaryName) {
    binaryName = getCliQueryEngineBinaryType()
  }
  enginePath = await resolveBinary(binaryName, enginePath)

  const platformInfo = await getPlatformWithOSResult()
  if (binaryName === BinaryType.QueryEngineLibrary) {
    assertNodeAPISupported()

    const QE = loadLibrary<NodeAPILibrary>(enginePath, platformInfo)
    return `${BinaryType.QueryEngineLibrary} ${QE.version().commit}`
  } else {
    // E.g, when enginePath refers to "migration-engine", this returns
    // `schema-engine-cli b952e556c57c90e9fe3152674d223600fba2a65d`.
    // "migration-engine" will be publicly renamed as "schema-engine" in Prisma 5.
    const { stdout } = await execa(enginePath, ['--version'])
    return stdout.replace('schema-engine-cli', 'migration-engine-cli')
  }
}

export function safeGetEngineVersion(enginePath?: string, binaryName?: BinaryType): TE.TaskEither<Error, string> {
  return TE.tryCatch(
    () => getEngineVersion(enginePath, binaryName),
    (error) => error as Error,
  )
}
