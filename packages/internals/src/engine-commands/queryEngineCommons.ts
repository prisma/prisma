import type { NodeAPILibraryTypes } from '@prisma/engine-core'
import { BinaryType } from '@prisma/fetch-engine'
import { isNodeAPISupported } from '@prisma/get-platform'
import chalk from 'chalk'
import * as E from 'fp-ts/Either'
import { pipe } from 'fp-ts/lib/function'
import * as TE from 'fp-ts/TaskEither'
import fs from 'fs'
import os from 'os'
import tmpWrite from 'temp-write'
import { match } from 'ts-pattern'

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
      (e) => {
        const error = e as Error
        const defaultErrorMessage = `Unable to establish a connection to query-engine-node-api library.`
        const proposedErrorFixMessage = match(error.message)
          // handle openssl loading error
          .when(
            (errMessage) => errMessage.includes('libssl'),
            () => {
              return ` It seems there is a problem with your OpenSSL installation!`
            },
          )

          // handle incompatible arch or c library error
          .when(
            (errMessage) => errMessage.includes('Unable to require'),
            () => {
              const architecture = os.arch()
              return ` It seems that the current architecture ${chalk.redBright(
                architecture,
              )} is not supported, or that ${chalk.redBright('libc')} is missing from the system.`
            },
          )

          // handle fallback with unknown fix
          .otherwise(() => '')
        const reason = `${defaultErrorMessage}${proposedErrorFixMessage}`
        return {
          type: 'connection-error' as const,
          reason,
          error,
        }
      },
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

export function createSchemaValidationError(reason: string) {
  return `${chalk.redBright.bold('Prisma schema validation')} - ${reason}`
}
