import Debug from '@prisma/debug'
import { getCliQueryEngineBinaryType } from '@prisma/engines'
import { BinaryType } from '@prisma/fetch-engine'
import type { DataSource, GeneratorConfig } from '@prisma/generator-helper'
import chalk from 'chalk'
import execa from 'execa'
import * as E from 'fp-ts/Either'
import { identity, pipe } from 'fp-ts/lib/function'
import * as TE from 'fp-ts/TaskEither'
import { match, P } from 'ts-pattern'

import { ErrorArea, isExecaErrorCausedByRustPanic, RustPanic } from '../panic'
import {
  createDebugErrorType,
  loadNodeAPILibrary,
  preliminaryBinaryPipeline,
  preliminaryNodeAPIPipeline,
  unlinkTempDatamodelPath,
} from './queryEngineCommons'

const debug = Debug('prisma:getConfig')

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
      return getConfigNodeAPI(options)
    })
    .with(BinaryType.queryEngine, () => {
      return getConfigBinary(options)
    })
    .exhaustive()
  return data
}

async function getConfigNodeAPI(options: GetConfigOptions) {
  const debugErrorType = createDebugErrorType(debug, 'getConfigNodeAPI')

  /**
   * Perform side effects to retrieve variables and metadata that may be useful in the main pipeline's
   * error handling.
   */
  const preliminaryEither = await preliminaryNodeAPIPipeline(options)()
  if (E.isLeft(preliminaryEither)) {
    const { left: e } = preliminaryEither
    debugErrorType(e)
    throw new GetConfigError(e.reason, e.error)
  }
  const { queryEnginePath } = preliminaryEither.right
  debug(`Using CLI Query Engine (Node-API Library) at: ${queryEnginePath}`)

  /**
   * - load the query engine library
   * - run the "getConfig" command
   */
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

  /**
   * Check which error to throw.
   */
  const error = match(configEither.left)
    .with({ type: 'node-api' }, (e) => {
      debugErrorType(e)

      /*
       * Extract the actual error by attempting to JSON-parse the error message.
       */
      const errorOutput = e.error.message
      const actualError = pipe(
        E.tryCatch(
          () => JSON.parse(errorOutput),
          () => {
            debug(`Coudln't apply JSON.parse to "${errorOutput}"`)
            return new GetConfigError(errorOutput, e.error)
          },
        ),
        E.map((errorOutputAsJSON: Record<string, string>) => {
          if (errorOutputAsJSON.is_panic) {
            const panic = new RustPanic(
              /* message */ errorOutputAsJSON.message,
              /* rustStack */ errorOutputAsJSON.backtrace || e.error.stack || 'NO_BACKTRACE',
              /* request */ 'query-engine-node-api get-config', // TODO: understand which type it expects
              ErrorArea.QUERY_ENGINE_LIBRARY_CLI,
              /* schemaPath */ options.prismaPath,
              /* schema */ undefined,
            )
            debug(`panic in getConfigNodeAPI "${e.type}"`, panic)
            return panic
          }

          const message = match(errorOutputAsJSON)
            .with({ error_code: 'P1012' }, (error: Record<string, string>) => {
              return chalk.redBright(`Schema Parsing ${error.error_code}\n\n`) + error.message + '\n'
            })
            .otherwise((error: any) => {
              return chalk.redBright(`${error.error_code}\n\n`) + error
            })
          return new GetConfigError(message, e.error)
        }),
        E.getOrElseW(identity),
      )

      return actualError
    })
    .otherwise((e) => {
      debugErrorType(e)
      return new GetConfigError(e.reason, e.error)
    })

  throw error
}

async function getConfigBinary(options: GetConfigOptions) {
  const debugErrorType = createDebugErrorType(debug, 'getConfigBinary')

  /**
   * Perform side effects to retrieve variables and metadata that may be useful in the main pipeline's
   * error handling. For instance, `tempDatamodelPath` is used when submit a Rust panic error report.
   */
  const preliminaryEither = await preliminaryBinaryPipeline(options)()
  if (E.isLeft(preliminaryEither)) {
    const { left: e } = preliminaryEither
    debugErrorType(e)
    throw new GetConfigError(e.reason, e.error)
  }
  const { queryEnginePath, tempDatamodelPath } = preliminaryEither.right
  debug(`Using CLI Query Engine (Binary) at: ${queryEnginePath}`)
  debug(`PRISMA_DML_PATH: ${tempDatamodelPath}`)

  /**
   * - run the `query-engine cli get-config` command
   * - JSON-deserialize the command output
   */
  const pipeline = pipe(
    (() => {
      const execaOptions = {
        cwd: options.cwd,
        env: {
          PRISMA_DML_PATH: tempDatamodelPath,
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
    await unlinkTempDatamodelPath(options, tempDatamodelPath)()
    const { right: data } = configEither
    return data
  }

  /**
   * Check which error to throw.
   */
  const error: RustPanic | GetConfigError = match(configEither.left)
    .with({ type: 'execa' }, (e) => {
      debugErrorType(e)
      /**
       * Capture and propagate possible Rust panics.
       */
      if (isExecaErrorCausedByRustPanic(e.error)) {
        const panic = new RustPanic(
          /* message */ e.error.shortMessage,
          /* rustStack */ e.error.stderr,
          /* request */ 'query-engine get-config',
          ErrorArea.QUERY_ENGINE_BINARY_CLI,
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
          () => {
            debug(`Coudln't apply JSON.parse to "${errorOutput}"`)
            return new GetConfigError(errorOutput, e.error)
          },
        ),
        E.map((errorOutputAsJSON: Record<string, string>) => {
          const defaultMessage = `${chalk.redBright(errorOutputAsJSON.message)}\n`
          const message = match(errorOutputAsJSON)
            .with({ error_code: 'P1012' }, (error) => {
              return chalk.redBright(`Schema Parsing ${error.error_code}\n\n`) + defaultMessage
            })
            .with({ error_code: P.string }, (error) => {
              return chalk.redBright(`${error.error_code}\n\n`) + defaultMessage
            })
            .otherwise(() => {
              return defaultMessage
            })

          return new GetConfigError(message, e.error)
        }),
        E.getOrElse(identity),
      )
      return actualError
    })
    .otherwise((e) => {
      debugErrorType(e)
      return new GetConfigError(e.reason, e.error)
    })

  throw error
}
