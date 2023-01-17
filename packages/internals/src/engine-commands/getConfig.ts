import Debug from '@prisma/debug'
import { getCliQueryEngineBinaryType } from '@prisma/engines'
import { BinaryType } from '@prisma/fetch-engine'
import type { DataSource, EnvValue, GeneratorConfig } from '@prisma/generator-helper'
import chalk from 'chalk'
import execa from 'execa'
import * as E from 'fp-ts/Either'
import { identity, pipe } from 'fp-ts/lib/function'
import * as TE from 'fp-ts/TaskEither'
import { match, P } from 'ts-pattern'

import { ErrorArea, isExecaErrorCausedByRustPanic, isWasmPanic, RustPanic } from '../panic'
import { prismaFmt } from '../wasm'
import { addVersionDetailsToErrorMessage } from './errorHelpers'
import {
  createDebugErrorType,
  createSchemaValidationError,
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

type GetConfigErrorInit = {
  // e.g., `Schema parsing - Error while interacting with query-engine-node-api library`
  reason: string

  // e.g., Error validating model "public": The model name \`public\` is invalid.
  message: string
} & (
  | {
      // parsed as JSON
      readonly _tag: 'parsed'

      // e.g., `P1012`
      errorCode?: string
    }
  | {
      // text
      readonly _tag: 'unparsed'
    }
)

export class GetConfigError extends Error {
  constructor(params: GetConfigErrorInit) {
    const constructedErrorMessage = match(params)
      .with({ _tag: 'parsed' }, ({ errorCode, message, reason }) => {
        const errorCodeMessage = errorCode ? `Error code: ${errorCode}` : ''
        return `${reason}
${errorCodeMessage}
${message}`
      })
      .with({ _tag: 'unparsed' }, ({ message, reason }) => {
        const detailsHeader = chalk.red.bold('Details:')
        return `${reason}
${detailsHeader} ${message}`
      })
      .exhaustive()

    const errorMessageWithContext = `${constructedErrorMessage}
[Context: getConfig]`

    super(addVersionDetailsToErrorMessage(errorMessageWithContext))
  }
}

export function getEffectiveUrl(ds: DataSource): EnvValue {
  if (ds.directUrl !== undefined) return ds.directUrl

  return ds.url
}

export async function getConfig(options: GetConfigOptions): Promise<ConfigMetaFormat> {
  const cliEngineBinaryType = getCliQueryEngineBinaryType()

  // always use Wasm for now. At some point we'll get rid of the node-api and binary getConfig
  const data: ConfigMetaFormat = await match(cliEngineBinaryType)
    .when(
      () => true,
      () => {
        return getConfigWasm(options)
      },
    )

    /**
     * @deprecated
     */
    .with(BinaryType.libqueryEngine, () => {
      return getConfigNodeAPI(options)
    })
    .with(BinaryType.queryEngine, () => {
      return getConfigBinary(options)
    })
    .exhaustive()
  return data
}

async function getConfigWasm(options: GetConfigOptions) {
  const debugErrorType = createDebugErrorType(debug, 'getConfigWasm')
  debug(`Using getConfig Wasm`)

  const configEither = pipe(
    E.tryCatch(
      () => {
        if (process.env.FORCE_PANIC_QUERY_ENGINE_GET_CONFIG) {
          debug('Triggering a Rust panic...')
          prismaFmt.debug_panic()
        }

        const params = JSON.stringify({
          prismaSchema: options.datamodel,
          datasourceOverrides: {},
          ignoreEnvVarErrors: options.ignoreEnvVarErrors ?? false,
          env: process.env,
        })

        const data = prismaFmt.get_config(params)
        return data
      },
      (e) => ({
        type: 'wasm-error' as const,
        reason: '(get-config wasm)',
        error: e as Error,
      }),
    ),
    E.map((result) => ({ result })),
    E.chainW(({ result }) =>
      // NOTE: this should never fail, as we expect returned values to be valid JSON-serializable strings
      E.tryCatch(
        () => JSON.parse(result) as ConfigMetaFormat,
        (e) => ({
          type: 'parse-json' as const,
          reason: 'Unable to parse JSON',
          error: e as Error,
        }),
      ),
    ),
  )

  if (E.isRight(configEither)) {
    debug('config data retrieved without errors in getConfig Wasm')
    const { right: data } = configEither
    return Promise.resolve(data)
  }

  /**
   * Check which error to throw.
   */
  const error = match(configEither.left)
    .with({ type: 'wasm-error' }, (e) => {
      debugErrorType(e)

      /**
       * Capture and propagate possible Wasm panics.
       */
      if (isWasmPanic(e.error)) {
        const wasmError = e.error as Error
        const panic = new RustPanic(
          /* message */ wasmError.message,
          /* rustStack */ wasmError.stack || 'NO_BACKTRACE',
          /* request */ '@prisma/prisma-fmt-wasm get_config',
          ErrorArea.FMT_CLI,
          /* schemaPath */ options.prismaPath,
          /* schema */ options.datamodel,
        )
        return panic
      }

      const errorOutput = e.error.message
      return parseConfigError({ errorOutput, reason: e.reason })
    })
    .otherwise((e) => {
      debugErrorType(e)
      return new GetConfigError({ _tag: 'unparsed', message: e.error.message, reason: e.reason })
    })

  throw error
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
    throw new GetConfigError({ _tag: 'unparsed', message: e.error.message, reason: e.reason })
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
          reason: '(query-engine-node-api library)',
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
            debug(`Couldn't apply JSON.parse to "${errorOutput}"`)
            return new GetConfigError({ _tag: 'unparsed', message: errorOutput, reason: e.reason })
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

          const { error_code: errorCode } = errorOutputAsJSON as { error_code: string | undefined }

          return new GetConfigError({
            _tag: 'parsed',
            message: errorOutputAsJSON.message,
            reason: createSchemaValidationError(e.reason),
            errorCode,
          })
        }),
        E.getOrElseW(identity),
      )

      return actualError
    })
    .otherwise((e) => {
      debugErrorType(e)
      return new GetConfigError({ _tag: 'unparsed', message: e.error.message, reason: e.reason })
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
    throw new GetConfigError({ _tag: 'unparsed', message: e.error.message, reason: e.reason })
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
          /**
           * NOTE: we could potentially Base64-encode the datamodel and store it the `PRISMA_DML` environment variable,
           * which is alternative to `PRISMA_DML_PATH`, but then chances are we'd get an `E2BIG` error when trying
           * to serialize big datamodels.
           */
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
          reason: '(query-engine binary)',
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

    // Unlink only when no error occurs, as `sendPanic` might need the `tempDatamodelPath` later in case of errors.
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
      return parseConfigError({ errorOutput, reason: e.reason })
    })
    .otherwise((e) => {
      debugErrorType(e)
      return new GetConfigError({ _tag: 'unparsed', message: e.error.message, reason: e.reason })
    })

  throw error
}

type ParseConfigError = {
  errorOutput: string
  reason: string
}

function parseConfigError({ errorOutput, reason }: ParseConfigError): GetConfigError {
  const actualError = pipe(
    E.tryCatch(
      () => JSON.parse(errorOutput),
      () => {
        debug(`Coudln't apply JSON.parse to "${errorOutput}"`)
        return new GetConfigError({ _tag: 'unparsed', message: errorOutput, reason })
      },
    ),
    E.map((errorOutputAsJSON: Record<string, string>) => {
      const defaultMessage = chalk.redBright(errorOutputAsJSON.message)
      const getConfigErrorInit = match(errorOutputAsJSON)
        .with({ error_code: 'P1012' }, (eJSON) => {
          return {
            reason: createSchemaValidationError(reason),
            errorCode: eJSON.error_code,
          }
        })
        .with({ error_code: P.string }, (eJSON) => {
          return {
            reason,
            errorCode: eJSON.error_code,
          }
        })
        .otherwise(() => {
          return {
            reason,
          }
        })

      return new GetConfigError({ _tag: 'parsed', message: defaultMessage, ...getConfigErrorInit })
    }),
    E.getOrElse(identity),
  )
  return actualError
}
