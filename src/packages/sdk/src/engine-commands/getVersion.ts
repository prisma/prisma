import Debug from '@prisma/debug'
import { NApiEngineTypes } from '@prisma/engine-core'
import { BinaryType } from '@prisma/fetch-engine'
import { isNodeAPISupported } from '@prisma/get-platform'
import execa from 'execa'
import { resolveBinary } from '../resolveBinary'

const debug = Debug('prisma:getVersion')

const MAX_BUFFER = 1_000_000_000

export async function getVersion(
  enginePath?: string,
  binaryName: BinaryType = BinaryType.queryEngine,
): Promise<string> {
  enginePath = await resolveBinary(binaryName, enginePath)
  if (binaryName === BinaryType.libqueryEngineNapi) {
    await isNodeAPISupported()

    const QE = require(enginePath) as NApiEngineTypes.NAPI
    return `libquery-engine ${QE.version().commit}`
  } else {
    const result = await execa(enginePath, ['--version'], {
      maxBuffer: MAX_BUFFER,
    })

    return result.stdout
  }
}
