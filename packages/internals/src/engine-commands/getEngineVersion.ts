import { getCliQueryEngineBinaryType } from '@prisma/engines'
import { BinaryType } from '@prisma/fetch-engine'
import { assertNodeAPISupported, getPlatformInfo } from '@prisma/get-platform'
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

  const platformInfo = await getPlatformInfo()
  if (binaryName === BinaryType.QueryEngineLibrary) {
    assertNodeAPISupported()

    const QE = loadLibrary<NodeAPILibrary>(enginePath, platformInfo)
    return `${BinaryType.QueryEngineLibrary} ${QE.version().commit}`
  }
    const { stdout } = await execa(enginePath, ['--version'])
    return stdout
}

export function safeGetEngineVersion(enginePath?: string, binaryName?: BinaryType): TE.TaskEither<Error, string> {
  return TE.tryCatch(
    () => getEngineVersion(enginePath, binaryName),
    (error) => error as Error,
  )
}
