import type { NodeAPILibraryTypes } from '@prisma/engine-core'
import { BinaryType } from '@prisma/fetch-engine'
import { isNodeAPISupported } from '@prisma/get-platform'
import * as E from 'fp-ts/Either'
import { pipe } from 'fp-ts/lib/function'
import * as TE from 'fp-ts/TaskEither'
import fs from 'fs'
import tmpWrite from 'temp-write'
import { promisify } from 'util'

import { resolveBinary } from '../resolveBinary'
import { load } from '../utils/load'

const unlink = promisify(fs.unlink)

export function preliminaryNodeAPIPipeline(options: { prismaPath?: string }) {
  return pipe(
    TE.tryCatch(
      () => resolveBinary(BinaryType.libqueryEngine, options.prismaPath),
      (e) => ({
        type: 'query-engine-unresolved',
        reason: 'Unable to resolve path to query-engine binary',
        error: e as Error, // "Could not find libquery-engine binary. Searched in..."
      }),
    ),
    TE.chainW((queryEnginePath) => {
      return pipe(
        TE.tryCatch(isNodeAPISupported, (e) => ({
          type: 'node-api-not-supported',
          reason: 'The query-engine library is not supported on this platform',
          error: e as Error,
        })),
        TE.map((_) => ({ queryEnginePath })),
      )
    }),
  )
}

export function preliminaryBinaryPipeline(options: {
  prismaPath?: string
  datamodelPath?: string
  datamodel?: string
}) {
  return pipe(
    TE.tryCatch(
      () => resolveBinary(BinaryType.queryEngine, options.prismaPath),
      (e) => ({
        type: 'query-engine-unresolved' as const,
        reason: 'Unable to resolve path to query-engine binary',
        error: e as Error, // "Could not find query-engine-* binary. Searched in..."
      }),
    ),
    TE.map((queryEnginePath) => ({ queryEnginePath })),
    TE.chainW(({ queryEnginePath }) => {
      if (!options.datamodelPath) {
        return pipe(
          TE.tryCatch(
            () => tmpWrite(options.datamodel!),
            (e) => ({
              type: 'datamodel-write' as const,
              reason: 'Unable to write temp data model path',
              error: e as Error,
            }),
          ),
          TE.map((tempDatamodelPath) => ({ queryEnginePath, tempDatamodelPath })),
        )
      }

      return TE.right({
        queryEnginePath,
        tempDatamodelPath: undefined as string | undefined,
      })
    }),
  )
}

export function loadNodeAPILibrary(queryEnginePath: string) {
  return pipe(
    E.tryCatch(
      () => load<NodeAPILibraryTypes.Library>(queryEnginePath),
      (e) => ({
        type: 'connection-error' as const,
        reason: 'Unable to establish a connection to query-engine-node-api library',
        error: e as Error,
      }),
    ),
    TE.fromEither,
    TE.map((NodeAPIQueryEngineLibrary) => ({ NodeAPIQueryEngineLibrary })),
  )
}

export function unlinkTempDatamodelPath(tempDatamodelPath: string) {
  return TE.tryCatch(
    () => {
      if (tempDatamodelPath) {
        return unlink(tempDatamodelPath)
      }

      return Promise.resolve(undefined)
    },
    (e) => ({
      type: 'unlink-temp-datamodel-path',
      reason: 'Unable to delete temporary datamodel path',
      error: e,
    }),
  )
}
