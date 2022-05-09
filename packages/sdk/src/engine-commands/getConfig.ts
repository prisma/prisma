import Debug from '@prisma/debug'
import { getCliQueryEngineBinaryType } from '@prisma/engines'
import { BinaryType } from '@prisma/fetch-engine'
import type { DataSource, GeneratorConfig } from '@prisma/generator-helper'
import chalk from 'chalk'
import execa, { ExecaError } from 'execa'
import * as E from 'fp-ts/Either'
import { identity, pipe } from 'fp-ts/lib/function'
import * as TE from 'fp-ts/TaskEither'
import fs from 'fs'
import { match } from 'ts-pattern'
import { promisify } from 'util'

import { ErrorArea, isExecaErrorCausedByRustPanic, RustPanic } from '../panic'
import { loadNodeAPILibrary, preliminaryBinaryPipeline, preliminaryNodeAPIPipeline } from './queryEngineCommons'

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
  constructor(message: string, public readonly _error?: Error) {
    super(chalk.redBright.bold('Get config: ') + message)
  }
}

export async function getConfig(options: GetConfigOptions): Promise<ConfigMetaFormat> {
  const cliEngineBinaryType = getCliQueryEngineBinaryType()
  const data: ConfigMetaFormat = await match(cliEngineBinaryType)
    .with(BinaryType.libqueryEngine, () => {
      // To trigger panic, run:
      // PRISMA_CLI_QUERY_ENGINE_TYPE=library FORCE_PANIC_QUERY_ENGINE_GET_CONFIG=1 npx prisma validate
      return getConfigNodeAPI(options)
    })
    .with(BinaryType.queryEngine, () => {
      // To trigger panic, run:
      // PRISMA_CLI_QUERY_ENGINE_TYPE=binary FORCE_PANIC_QUERY_ENGINE_GET_CONFIG=1 npx prisma validate
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
  const preliminaryEither = await preliminaryNodeAPIPipeline(options)()
  if (E.isLeft(preliminaryEither)) {
    const { reason, error } = preliminaryEither.left
    throw new GetConfigError(reason, error)
  }
  const { queryEnginePath } = preliminaryEither.right
  debug(`Using CLI Query Engine (Node-API Library) at: ${queryEnginePath}`)

  const pipeline = pipe(
    loadNodeAPILibrary(queryEnginePath),
    TE.chainW(({ NodeAPIQueryEngineLibrary }) => {
      debug('Loaded Node-API Library')
      return TE.tryCatch(
        () => {
          if (process.env.FORCE_PANIC_QUERY_ENGINE_GET_CONFIG) {
            debug('Triggering a Rust panic...')
            return NodeAPIQueryEngineLibrary.debugPanic('FORCE_PANIC_QUERY_ENGINE_GET_CONFIG')
          }

          // TODO: `result` is a `ConfigMetaFormat`, even though it's typed as `Promise<ConfigMetaFormat>`, so we should
          // probably change the type definition in `Library.ts` (in `@prisma/engine-core`)
          const data = NodeAPIQueryEngineLibrary.getConfig({
            datamodel: options.datamodel,
            datasourceOverrides: {},
            ignoreEnvVarErrors: options.ignoreEnvVarErrors ?? false,
            env: process.env,
          })
          return Promise.resolve(data)
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
  const preliminaryEither = await preliminaryBinaryPipeline(options)()
  if (E.isLeft(preliminaryEither)) {
    const { reason, error } = preliminaryEither.left

    // TODO: is there an existing way of embedding the error in GetConfigError?
    throw new GetConfigError(reason)
  }
  const { queryEnginePath, tempDatamodelPath } = preliminaryEither.right
  debug(`Using CLI Query Engine (Binary) at: ${queryEnginePath}`)

  const pipeline = pipe(
    (() => {
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

      return TE.tryCatch(
        () => {
          if (process.env.FORCE_PANIC_QUERY_ENGINE_GET_CONFIG) {
            debug('Triggering a Rust panic...')
            return execa(
              queryEnginePath,
              [...engineArgs, 'cli', 'debug-panic', '--message', 'FORCE_PANIC_QUERY_ENGINE_GET_CONFIG'],
              execaOptions,
            )
          }

          return execa(queryEnginePath, [...engineArgs, 'cli', 'get-config', ...args], execaOptions)
        },
        (e) => ({
          type: 'execa' as const,
          reason: 'Error while interacting with query-engine binary',
          error: e as execa.ExecaError,
        }),
      )
    })(),
    TE.map((result) => ({ result })),
    TE.chainW(({ result }) => {
      return pipe(
        E.tryCatch(
          () => JSON.parse(result.stdout) as ConfigMetaFormat,
          (e) => ({
            type: 'parse-json' as const,
            reason: 'Unable to parse JSON',
            error: e as Error,
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
    .with({ type: 'execa' }, (e) => {
      debug(`error in getConfigBinary "${e.type}"`, e)
      /**
       * Capture and propagate possible Rust panics.
       */
      if (isExecaErrorCausedByRustPanic(e.error)) {
        const panic = new RustPanic(
          /* message */ e.error.shortMessage,
          /* rustStack */ e.error.stderr,
          /* request */ 'query-engine get-config',
          ErrorArea.INTROSPECTION_CLI, // TODO: change to QUERY_ENGINE_BINARY_CLI
          /* schemaPath */ options.datamodelPath ?? tempDatamodelPath,
          /* schema */ undefined,
        )
        debug(`panic in getConfigBinary "${e.type}"`, panic)
        return panic
      }

      /**
       * Extract the actual error by attempting to JSON-parse the output of the query-engine binary.
       */
      const errorOutput = e.error.stderr ?? e.error.stdout
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

          return new GetConfigError(message, e.error)
        }),
        E.getOrElse(identity),
      )
      return actualError
    })
    .otherwise((e) => {
      debug(`error in getConfigBinary "${e.type}"`, e)
      return new GetConfigError(e.reason, e.error)
    })

  throw error
}
