import type { NodeAPILibraryTypes } from '@prisma/engine-core'
import { BinaryType } from '@prisma/fetch-engine'
import { isNodeAPISupported } from '@prisma/get-platform'
import * as E from 'fp-ts/Either'
import { pipe } from 'fp-ts/lib/function'
import * as TE from 'fp-ts/TaskEither'
import fs from 'fs'
import tmpWrite from 'temp-write'

import { resolveBinary } from '../resolveBinary'
import { load } from '../utils/load'

export function preliminaryNodeAPIPipeline(options: { prismaPath?: string }) {
  return pipe(
    TE.tryCatch(
      () => resolveBinary(BinaryType.libqueryEngine, options.prismaPath),
      (e) => ({
        type: 'query-engine-unresolved' as const,
        reason: 'Unable to resolve path to query-engine binary',
        error: e as Error, // "Could not find libquery-engine binary. Searched in..."
      }),
    ),
    TE.chainW((queryEnginePath) => {
      return pipe(
        TE.tryCatch(isNodeAPISupported, (e) => ({
          type: 'node-api-not-supported' as const,
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
        tempDatamodelPath: options.datamodelPath,
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
        reason: `Unable to establish a connection to query-engine-node-api library. Have you tried installing 'openssl'?`,
        error: e as Error,
      }),
    ),
    TE.fromEither,
    TE.map((NodeAPIQueryEngineLibrary) => ({ NodeAPIQueryEngineLibrary })),
  )
}

export function unlinkTempDatamodelPath(options: { datamodelPath?: string }, tempDatamodelPath: string | undefined) {
  return TE.tryCatch(
    () => {
      if (!options.datamodelPath && tempDatamodelPath) {
        return fs.promises.unlink(tempDatamodelPath)
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

export const createDebugErrorType =
  (debug: (formatter: any, ...args: any[]) => void, fnName: string) =>
  ({ type, reason, error }: { type: string; reason: string; error: Error }) => {
    debug(`error of type "${type}" in ${fnName}:\n`, { reason, error })
  }
