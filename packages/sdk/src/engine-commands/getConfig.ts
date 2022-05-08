import Debug from '@prisma/debug'
import type { NodeAPILibraryTypes } from '@prisma/engine-core'
import { getCliQueryEngineBinaryType } from '@prisma/engines'
import { BinaryType } from '@prisma/fetch-engine'
import type { DataSource, GeneratorConfig } from '@prisma/generator-helper'
import { isNodeAPISupported } from '@prisma/get-platform'
import chalk from 'chalk'
import execa, { ExecaError } from 'execa'
import * as E from 'fp-ts/Either'
import { identity, pipe } from 'fp-ts/lib/function'
import * as TE from 'fp-ts/TaskEither'
import fs from 'fs'
import tmpWrite from 'temp-write'
import { match } from 'ts-pattern'
import { promisify } from 'util'

import { ErrorArea, isExecaErrorCausedByRustPanic, RustPanic } from '../panic'
import { resolveBinary } from '../resolveBinary'
import { load } from '../utils/load'

const debug = Debug('prisma:getConfig')

const unlink = promisify(fs.unlink)

const MAX_BUFFER = 1_000_000_000

export interface ConfigMetaFormat {
  datasources: DataSource[] | []
  generators: GeneratorConfig[] | []
  warnings: string[] | []
}

export type GetConfigOptions = {
  datamodel: string
  cwd?: string
  prismaPath?: string
  datamodelPath?: string
  retry?: number
  ignoreEnvVarErrors?: boolean
}
export class GetConfigError extends Error {
  constructor(message: string) {
    super(chalk.redBright.bold('Get config: ') + message)
  }
}

export async function getConfig(options: GetConfigOptions): Promise<ConfigMetaFormat> {
  const cliEngineBinaryType = getCliQueryEngineBinaryType()
  const data: ConfigMetaFormat = await match(cliEngineBinaryType)
    .with(BinaryType.libqueryEngine, () => {
      return getConfigNodeAPI(options)
    })
    .with(BinaryType.queryEngine, () => {
      return getConfigBinary(options)
    })
    .exhaustive()
  return data
}

async function getConfigNodeAPI(options: GetConfigOptions) {
  /**
   * Perform side effects to retrieve variables and metadata that may be useful in the main pipeline's
   * error handling.
   */
  const preliminaryEither = await pipe(
    TE.Do,
    TE.bind('queryEnginePath', () => {
      return TE.tryCatch(
        () => resolveBinary(BinaryType.libqueryEngine, options.prismaPath),
        (e) => ({
          type: 'query-engine-unresolved',
          reason: 'Unable to resolve path to query-engine binary',
          error: e as Error, // "Could not find libquery-engine binary. Searched in..."
        }),
      )
    }),
    TE.bind('_', () => {
      return TE.tryCatch(
        () => isNodeAPISupported(),
        (e) => ({
          type: 'node-api-not-support',
          reason: 'The query-engine library is not supported on this platform',
          error: e as Error,
        }),
      )
    }),
  )()
  if (E.isLeft(preliminaryEither)) {
    const { reason, error } = preliminaryEither.left

    // TODO: is there an existing way of embedding the error in GetConfigError?
    throw new GetConfigError(reason)
  }
  const { queryEnginePath } = preliminaryEither.right
  debug(`Using CLI Query Engine (Node-API Library) at: ${queryEnginePath}`)

  const pipeline = pipe(
    pipe(
      E.tryCatch(
        () => load<NodeAPILibraryTypes.Library>(queryEnginePath),
        (e) => ({
          type: 'connection-error' as const,
          reason: 'Unable to establish a connection to query-engine-node-api library',
          error: e as Error,
        }),
      ),
      TE.fromEither,
    ),
    TE.map((NodeAPIQueryEngineLibrary) => ({ NodeAPIQueryEngineLibrary })),
    TE.chainW(({ NodeAPIQueryEngineLibrary }) => {
      return TE.tryCatch(
        () => {
          if (process.env.FORCE_PANIC_QUERY_ENGINE_GET_CONFIG) {
            // trigger a Rust panic
            return NodeAPIQueryEngineLibrary.debugPanic('FORCE_PANIC_QUERY_ENGINE_GET_CONFIG')
          }

          return NodeAPIQueryEngineLibrary.getConfig({
            datamodel: options.datamodel,
            datasourceOverrides: {},
            ignoreEnvVarErrors: options.ignoreEnvVarErrors ?? false,
            env: process.env,
          })
        },
        (e) => ({
          type: 'node-api' as const,
          reason: 'Error while interacting with query-engine-node-api library',
          error: e as Error,
        }),
      )
    }),
  )

  const configEither = await pipeline()
  if (E.isRight(configEither)) {
    debug('config data retrieved without errors in getConfigNodeAPI')
    const { right: data } = configEither
    return data
  }

  const error = match(configEither.left)
    .with({ type: 'node-api' }, (e) => {
      debug(`error in getConfigNodeAPI "${e.type}"`, e)

      let error
      try {
        error = JSON.parse((e.error as any).message)
        if (error.is_panic) {
          const panic = new RustPanic(
            /* message */ error.message,
            /* rustStack */ error.backtrace || 'NO_BACKTRACE', // TODO: understand how to retrieve stacktrace for node-api
            /* request */ 'query-engine-node-api get-config',
            ErrorArea.INTROSPECTION_CLI, // TODO: change to QUERY_ENGINE_LIBRARY
            /* schemaPath */ options.prismaPath,
            /* schema */ undefined,
          )
          debug(`panic in getConfigNodeAPI "${e.type}"`, panic)
          return panic
        }
      } catch (jsonError) {
        return new GetConfigError(e.reason)
      }
      let message: string
      if (error.error_code === 'P1012') {
        message = chalk.redBright(`Schema Parsing ${error.error_code}\n\n`) + error.message + '\n'
      } else {
        message = chalk.redBright(`${error.error_code}\n\n`) + error
      }
      return new GetConfigError(message)
    })
    .otherwise((e) => {
      debug(`error in getConfigNodeAPI "${e.type}"`, e)
      return new GetConfigError(e.reason)
    })

  throw error
}

async function getConfigBinary(options: GetConfigOptions) {
  /**
   * Perform side effects to retrieve variables and metadata that may be useful in the main pipeline's
   * error handling.
   */
  const preliminaryEither = await pipe(
    TE.tryCatch(
      () => resolveBinary(BinaryType.queryEngine, options.prismaPath),
      (e) => ({
        type: 'query-engine-unresolved' as const,
        reason: 'Unable to resolve path to query-engine binary',
        error: e as Error,
      }),
    ),
    TE.map((queryEnginePath) => ({ queryEnginePath })),
    TE.chainW(({ queryEnginePath }) => {
      if (!options.datamodelPath) {
        return pipe(
          TE.tryCatch(
            () => tmpWrite(options.datamodel),
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
  )()
  if (E.isLeft(preliminaryEither)) {
    const { reason, error } = preliminaryEither.left

    // TODO: is there an existing way of embedding the error in GetConfigError?
    throw new GetConfigError(reason)
  }
  const { queryEnginePath, tempDatamodelPath } = preliminaryEither.right
  debug(`Using CLI Query Engine (Binary) at: ${queryEnginePath}`)

  const pipeline = pipe(
    TE.Do,
    TE.bind('result', () => {
      const execaOptions = {
        cwd: options.cwd,
        env: {
          PRISMA_DML_PATH: options.datamodelPath ?? tempDatamodelPath,
          RUST_BACKTRACE: '1',
        },
        maxBuffer: MAX_BUFFER,
      }

      const engineArgs = []
      const args = options.ignoreEnvVarErrors ? ['--ignoreEnvVarErrors'] : []

      if (process.env.FORCE_PANIC_QUERY_ENGINE_GET_CONFIG) {
        return TE.tryCatch(
          () =>
            execa(
              queryEnginePath,
              [...engineArgs, 'cli', 'debug-panic', '--message', 'FORCE_PANIC_QUERY_ENGINE_GET_CONFIG'],
              execaOptions,
            ),
          (e) => ({
            type: 'execa' as const,
            reason: 'Error while interacting with query-engine binary',
            error: e,
          }),
        )
      }

      return TE.tryCatch(
        () => execa(queryEnginePath, [...engineArgs, 'cli', 'get-config', ...args], execaOptions),
        (e) => ({
          type: 'execa' as const,
          reason: 'Error while interacting with query-engine binary',
          error: e,
        }),
      )
    }),
    TE.chainW(({ result }) => {
      return pipe(
        E.tryCatch(
          () => JSON.parse(result.stdout) as ConfigMetaFormat,
          (e) => ({
            type: 'parse-json' as const,
            reason: 'Unable to parse JSON',
            error: e,
          }),
        ),
        TE.fromEither,
      )
    }),
  )

  const configEither = await pipeline()
  if (E.isRight(configEither)) {
    debug('config data retrieved without errors in getConfigBinary')
    const { right: data } = configEither

    // TODO: we may want to show a warning in case we're not able to delete a temporary path
    const unlinkEither = await TE.tryCatch(
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
    )()

    return data
  }

  const error: RustPanic | GetConfigError = match(configEither.left)
    .with({ type: 'execa' }, ({ error, reason, type }) => {
      debug(`error in getConfigBinary "${type}"`, { error, reason, type })
      const e = error as ExecaError

      /**
       * Capture and propagate possible Rust panics.
       */
      if (isExecaErrorCausedByRustPanic(e as execa.ExecaError)) {
        const panic = new RustPanic(
          /* message */ e.shortMessage,
          /* rustStack */ e.stderr,
          /* request */ 'query-engine get-config',
          ErrorArea.INTROSPECTION_CLI, // TODO: change to QUERY_ENGINE_BINARY_CLI
          /* schemaPath */ options.datamodelPath ?? tempDatamodelPath,
          /* schema */ undefined,
        )
        debug(`panic in getConfigBinary "${type}"`, panic)
        return panic
      }

      /**
       * Extract the actual error by attempting to JSON-parse the output of the query-engine binary.
       */
      const errorOutput = e.stderr ? e.stderr : e.stdout
      const actualError = pipe(
        E.tryCatch(
          () => JSON.parse(errorOutput),
          () => new GetConfigError(errorOutput),
        ),
        E.map((jsonError) => {
          let message = `${chalk.redBright(jsonError.message)}\n`
          if (jsonError.error_code) {
            if (jsonError.error_code === 'P1012') {
              message = chalk.redBright(`Schema Parsing ${jsonError.error_code}\n\n`) + message
            } else {
              message = chalk.redBright(`${jsonError.error_code}\n\n`) + message
            }
          }

          return new GetConfigError(message)
        }),
        E.getOrElse(identity),
      )
      return actualError
    })
    .otherwise((e) => {
      debug(`error in getConfigBinary "${e.type}"`, e)
      return new GetConfigError(e.reason)
    })

  throw error
}
