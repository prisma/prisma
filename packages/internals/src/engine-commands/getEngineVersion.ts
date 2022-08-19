import type { NodeAPILibraryTypes } from '@prisma/engine-core'
import { getCliQueryEngineBinaryType } from '@prisma/engines'
import { BinaryType } from '@prisma/fetch-engine'
import { isNodeAPISupported } from '@prisma/get-platform'
import execa from 'execa'
import * as TE from 'fp-ts/TaskEither'
import { match } from 'ts-pattern'

import { resolveBinary } from '../resolveBinary'
import { load } from '../utils/load'

// Note: using `import { dependencies } from '../../package.json'` here would break esbuild with seemingly unrelated errors.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { dependencies } = require('../../package.json')

export async function getEngineVersion(enginePath?: string, binaryName?: BinaryType): Promise<string> {
  if (!binaryName) {
    binaryName = getCliQueryEngineBinaryType()
  }
  enginePath = await resolveBinary(binaryName, enginePath)
  if (binaryName === BinaryType.libqueryEngine) {
    await isNodeAPISupported()

    const QE = load<NodeAPILibraryTypes.Library>(enginePath)
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

type WasmEngineType = Extract<BinaryType, BinaryType.prismaFmt>

/**
 * Extract the npm/hash version of the given Wasm engine.
 */
export function getWasmVersion(engineName: WasmEngineType): string {
  const wasmVersion = match(engineName)
    .with(BinaryType.prismaFmt, () => dependencies['@prisma/prisma-fmt-wasm'] as string)
    .exhaustive()

  return wasmVersion
}
