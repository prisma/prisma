import type { NodeAPILibraryTypes } from '@prisma/engine-core'
import { getCliQueryEngineType } from '@prisma/engines'
import { EngineTypeEnum } from '@prisma/fetch-engine'
import { isNodeAPISupported } from '@prisma/get-platform'
import execa from 'execa'

import { resolveEngine } from '../resolveEngine'
import { load } from '../utils/load'

const MAX_BUFFER = 1_000_000_000

export async function getEngineVersion(enginePath?: string, engineName?: EngineTypeEnum): Promise<string> {
  if (!engineName) {
    engineName = getCliQueryEngineType()
  }
  enginePath = await resolveEngine(engineName, enginePath)
  if (engineName === EngineTypeEnum.libqueryEngine) {
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
