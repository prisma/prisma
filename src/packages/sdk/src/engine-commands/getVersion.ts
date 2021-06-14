import Debug from '@prisma/debug'
import { NApiEngineTypes } from '@prisma/engine-core'
import { EngineTypes } from '@prisma/fetch-engine'
import execa from 'execa'
import { resolveBinary } from '../resolveBinary'
import { isNodeAPISupported } from './isNodeAPISupported'

const debug = Debug('prisma:getVersion')

const MAX_BUFFER = 1_000_000_000

export async function getVersion(
  enginePath?: string,
  binaryName: EngineTypes = EngineTypes.queryEngine,
): Promise<string> {
  enginePath = await resolveBinary(binaryName, enginePath)
  if (binaryName === EngineTypes.libqueryEngineNapi) {
    await isNodeAPISupported()

    const QE = require(enginePath) as NApiEngineTypes.NAPI
    return `libquery-engine-napi ${QE.version().commit}`
  } else {
    const result = await execa(enginePath, ['--version'], {
      maxBuffer: MAX_BUFFER,
    })

    return result.stdout
  }
}
