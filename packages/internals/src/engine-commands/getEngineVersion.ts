import type { NodeAPILibraryTypes } from '@prisma/engine-core'
import { getCliQueryEngineType } from '@prisma/engines'
import { EngineTypeEnum } from '@prisma/fetch-engine'
import { isNodeAPISupported } from '@prisma/get-platform'
import execa from 'execa'

import { resolveBinary } from '../resolveBinary'
import { load } from '../utils/load'

const MAX_BUFFER = 1_000_000_000

export async function getEngineVersion(enginePath?: string, binaryName?: EngineTypeEnum): Promise<string> {
  if (!binaryName) {
    binaryName = getCliQueryEngineType()
  }
  enginePath = await resolveBinary(binaryName, enginePath)
  if (binaryName === EngineTypeEnum.libqueryEngine) {
    await isNodeAPISupported()

    const QE = load<NodeAPILibraryTypes.Library>(enginePath)
    return `libquery-engine ${QE.version().commit}`
  } else {
    const result = await execa(enginePath, ['--version'], {
      maxBuffer: MAX_BUFFER,
    })

    return result.stdout
  }
}
