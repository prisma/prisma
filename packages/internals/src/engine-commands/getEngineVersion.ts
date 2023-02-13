import type { NodeAPILibraryTypes } from '@prisma/engine-core'
import { getCliQueryEngineBinaryType } from '@prisma/engines'
import { BinaryType } from '@prisma/fetch-engine'
import { getPlatformWithOSResult, isNodeAPISupported } from '@prisma/get-platform'
import execa from 'execa'
import * as TE from 'fp-ts/TaskEither'

import { resolveBinary } from '../resolveBinary'
import { loadLibrary } from '../utils/load'

export async function getEngineVersion(enginePath?: string, binaryName?: BinaryType): Promise<string> {
  if (!binaryName) {
    binaryName = getCliQueryEngineBinaryType()
  }
  enginePath = await resolveBinary(binaryName, enginePath)

  const platformInfo = await getPlatformWithOSResult()
  if (binaryName === BinaryType.libqueryEngine) {
    await isNodeAPISupported()

    const QE = loadLibrary<NodeAPILibraryTypes.Library>(enginePath, platformInfo)
    return `${BinaryType.libqueryEngine} ${QE.version().commit}`
  } else {
    const result = await execa(enginePath, ['--version'])

    return result.stdout
  }
}

export function safeGetEngineVersion(enginePath?: string, binaryName?: BinaryType): TE.TaskEither<Error, string> {
  return TE.tryCatch(
    () => getEngineVersion(enginePath, binaryName),
    (error) => error as Error,
  )
}
