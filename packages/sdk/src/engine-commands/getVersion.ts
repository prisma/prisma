import Debug from '@prisma/debug'
import type { NodeAPILibraryTypes } from '@prisma/engine-core'
import { getCliQueryEngineType } from '@prisma/engines'
import { EngineType } from '@prisma/fetch-engine'
import { isNodeAPISupported } from '@prisma/get-platform'
import execa from 'execa'

import { resolveEngine } from '../resolveEngine'
import { load } from '../utils/load'

const debug = Debug('prisma:getVersion')

const MAX_BUFFER = 1_000_000_000

export async function getVersion(enginePath?: string, engineType?: EngineType): Promise<string> {
  if (!engineType) {
    const cliQueryEngineType = getCliQueryEngineType()
    engineType = cliQueryEngineType
  }
  enginePath = await resolveEngine(engineType, enginePath)
  if (engineType === EngineType.libqueryEngine) {
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
