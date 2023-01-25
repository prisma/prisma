import Debug from '@prisma/debug'
import { getCliQueryEngineBinaryType } from '@prisma/engines'
import { BinaryType } from '@prisma/fetch-engine'
import type { DataSource, DMMF, GeneratorConfig } from '@prisma/generator-helper'
import chalk from 'chalk'
import execa from 'execa'
import * as E from 'fp-ts/Either'
import { identity, pipe } from 'fp-ts/lib/function'
import * as TE from 'fp-ts/TaskEither'
import fs from 'fs'
import { match } from 'ts-pattern'

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

const debug = Debug('prisma:getDMMF')

const MAX_BUFFER = 1_000_000_000

export interface ConfigMetaFormat {
  datasources: DataSource[]
  generators: GeneratorConfig[]
  warnings: string[]
}

export type GetDMMFOptions = {
  datamodel?: string
  cwd?: string
  prismaPath?: string
  datamodelPath?: string
  retry?: number
  previewFeatures?: string[]
}

type GetDmmfErrorInit = {
  // e.g., `Schema parsing - Error while interacting with query-engine-node-api library`
  reason: string

  // e.g., Error validating model "public": The model name \`public\` is invalid.
  message: string
} & (
  | {
      // JSON
      readonly _tag: 'parsed'

      // e.g., `P1012`
      errorCode?: string
    }
  | {
      // text
      readonly _tag: 'unparsed'
    }
)

export class GetDmmfError extends Error {
  constructor(params: GetDmmfErrorInit) {
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
[Context: getDmmf]`

    super(addVersionDetailsToErrorMessage(errorMessageWithContext))
  }
}

export async function getDMMF(options: GetDMMFOptions): Promise<DMMF.Document> {
  warnOnDeprecatedFeatureFlag(options.previewFeatures)
  const cliEngineBinaryType = getCliQueryEngineBinaryType()
  const dmmf: DMMF.Document = await match(cliEngineBinaryType)
    .when(
      () => true,
      () => {
        return getDmmfWasm(options)
      },
    )

    /**
     * @deprecated
     */
    .with(BinaryType.libqueryEngine, () => {
      return getDmmfNodeAPI(options)
    })
    .with(BinaryType.queryEngine, () => {
      // Note: this function may be retried in case of:
      // - ETXTBSY (busy) error
      // - when reading 'Retrying after "Please wait until"' from the console output
      return getDmmfBinary(options)
    })
    .exhaustive()
  return dmmf
}

async function getDmmfWasm(options: GetDMMFOptions) {
  const debugErrorType = createDebugErrorType(debug, 'getDmmfWasm')
  debug(`Using getDmmf Wasm`)

  const dmmfEither = pipe(
    E.tryCatch(
      () => {
        if (process.env.FORCE_PANIC_QUERY_ENGINE_GET_DMMF) {
          debug('Triggering a Rust panic...')
          prismaFmt.debug_panic()
        }

        const params = JSON.stringify({
          prismaSchema: options.datamodel,
        })

        const data = prismaFmt.get_dmmf(params)
        return data
      },
      (e) => ({
        type: 'wasm-error' as const,
        reason: '(get-dmmf wasm)',
        error: e as Error,
      }),
    ),
    E.map((result) => ({ result })),
    E.chainW(({ result }) =>
      // NOTE: this should never fail, as we expect returned values to be valid JSON-serializable strings
      E.tryCatch(
        () => JSON.parse(result) as DMMF.Document,
        (e) => ({
          type: 'parse-json' as const,
          reason: 'Unable to parse JSON',
          error: e as Error,
        }),
      ),
    ),
  )

  if (E.isRight(dmmfEither)) {
    debug('dmmf data retrieved without errors in getDmmf Wasm')
    const { right: data } = dmmfEither
    return Promise.resolve(data)
  }

  /**
   * Check which error to throw.
   */
  const error = match(dmmfEither.left)
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
          /* request */ '@prisma/prisma-fmt-wasm get_dmmf',
          ErrorArea.FMT_CLI,
          /* schemaPath */ options.prismaPath,
          /* schema */ options.datamodel,
        )
        return panic
      }

      /*
       * Extract the actual error by attempting to JSON-parse the error message.
       */
      const errorOutput = e.error.message
      const actualError = pipe(
        E.tryCatch(
          () => JSON.parse(errorOutput),
          () => {
            debug(`Couldn't apply JSON.parse to "${errorOutput}"`)
            return new GetDmmfError({ _tag: 'unparsed', message: errorOutput, reason: e.reason })
          },
        ),
        E.map((errorOutputAsJSON: Record<string, string>) => {
          const { error_code: errorCode } = errorOutputAsJSON as { error_code: string | undefined }

          return new GetDmmfError({
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
      return new GetDmmfError({ _tag: 'unparsed', message: e.error.message, reason: e.reason })
    })

  throw error
}

async function getDmmfNodeAPI(options: GetDMMFOptions) {
  const debugErrorType = createDebugErrorType(debug, 'getDmmfNodeAPI')

  /**
   * Perform side effects to retrieve variables and metadata that may be useful in the main pipeline's
   * error handling.
   */
  const preliminaryEither = await preliminaryNodeAPIPipeline(options)()
  if (E.isLeft(preliminaryEither)) {
    const { left: e } = preliminaryEither
    debugErrorType(e)
    throw new GetDmmfError({ _tag: 'unparsed', message: e.error.message, reason: e.reason })
  }
  const { queryEnginePath } = preliminaryEither.right
  debug(`Using CLI Query Engine (Node-API Library) at: ${queryEnginePath}`)

  /**
   * - load the query engine library
   * - create a temporary schema file if one is not provided
   * - run the "dmmf" command
   * - JSON-deserialize the "dmmf" output
   */
  const pipeline = pipe(
    loadNodeAPILibrary(queryEnginePath),
    TE.chainW(({ NodeAPIQueryEngineLibrary }) => {
      debug('Loaded Node-API Library')
      return pipe(
        TE.tryCatch(
          () => {
            if (options.datamodel) {
              return Promise.resolve(options.datamodel)
            }

            return fs.promises.readFile(options.datamodelPath!, 'utf-8')
          },
          (e) => ({
            type: 'read-datamodel-path' as const,
            reason: 'Error while trying to read datamodel path',
            error: e as Error,
            datamodelPath: options.datamodelPath,
          }),
        ),
        TE.map((datamodel) => ({ NodeAPIQueryEngineLibrary, datamodel })),
      )
    }),
    TE.chainW(({ NodeAPIQueryEngineLibrary, datamodel }) => {
      return pipe(
        TE.tryCatch(
          () => {
            if (process.env.FORCE_PANIC_QUERY_ENGINE_GET_DMMF) {
              debug('Triggering a Rust panic...')
              return NodeAPIQueryEngineLibrary.debugPanic('FORCE_PANIC_QUERY_ENGINE_GET_DMMF')
            }

            // TODO: `result` is a `string`, even though it's typed as `Promise<string>`, so we should
            // probably change the type definition in `Library.ts` (in `@prisma/engine-core`)
            const result = NodeAPIQueryEngineLibrary.dmmf(datamodel)
            return Promise.resolve(result)
          },
          (e) => ({
            type: 'node-api' as const,
            reason: '(query-engine-node-api library)',
            error: e as Error,
            datamodel,
          }),
        ),
        TE.map((result) => ({ result })),
      )
    }),
    TE.chainW(({ result }) => {
      debug('unserialized dmmf result ready')
      return pipe(
        E.tryCatch(
          () => JSON.parse(result) as DMMF.Document,
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

  const dmmfEither = await pipeline()
  if (E.isRight(dmmfEither)) {
    debug('dmmf retrieved without errors in getDmmfNodeAPI')
    const { right: dmmf } = dmmfEither
    return dmmf
  }

  /**
   * Check which error to throw.
   */
  const error = match(dmmfEither.left)
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
            return new GetDmmfError({ _tag: 'unparsed', message: errorOutput, reason: e.reason })
          },
        ),
        E.map((errorOutputAsJSON: Record<string, string>) => {
          if (errorOutputAsJSON.is_panic) {
            const panic = new RustPanic(
              /* message */ errorOutputAsJSON.message,
              /* rustStack */ errorOutputAsJSON.backtrace || e.error.stack || 'NO_BACKTRACE',
              /* request */ 'query-engine-node-api get-dmmf', // TODO: understand which type it expects
              ErrorArea.QUERY_ENGINE_LIBRARY_CLI,
              /* schemaPath */ options.prismaPath,
              /* schema */ e.datamodel,
            )
            debug(`panic in getDmmfNodeAPI "${e.type}"`, panic)
            return panic
          }

          const defaultMessage = addMissingOpenSSLInfo(errorOutputAsJSON.message)
          const { error_code: errorCode } = errorOutputAsJSON as { error_code: string | undefined }

          return new GetDmmfError({
            _tag: 'parsed',
            message: defaultMessage,
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
      return new GetDmmfError({ _tag: 'unparsed', message: e.error.message, reason: e.reason })
    })

  throw error
}

async function getDmmfBinary(options: GetDMMFOptions): Promise<DMMF.Document> {
  const debugErrorType = createDebugErrorType(debug, 'getDmmfBinary')

  /**
   * Perform side effects to retrieve variables and metadata that may be useful in the main pipeline's
   * error handling. For instance, `tempDatamodelPath` is used when submit a Rust panic error report.
   */
  const preliminaryEither = await preliminaryBinaryPipeline(options)()
  if (E.isLeft(preliminaryEither)) {
    const { left: e } = preliminaryEither
    debugErrorType(e)
    throw new GetDmmfError({ _tag: 'unparsed', message: e.error.message, reason: e.reason })
  }
  const { queryEnginePath, tempDatamodelPath } = preliminaryEither.right
  debug(`Using CLI Query Engine (Binary) at: ${queryEnginePath}`)
  debug(`PRISMA_DML_PATH: ${tempDatamodelPath}`)

  /**
   * - run the `query-engine cli dmmf` command
   * - JSON-deserialize the command output, starting from the first appearance of "{"
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
          RUST_BACKTRACE: process.env.RUST_BACKTRACE ?? '1',
          ...(process.env.NO_COLOR ? {} : { CLICOLOR_FORCE: '1' }),
        },
        maxBuffer: MAX_BUFFER,
      }

      const args = ['--enable-raw-queries', 'cli', 'dmmf']

      return TE.tryCatch(
        () => {
          if (process.env.FORCE_PANIC_QUERY_ENGINE_GET_DMMF) {
            debug('Triggering a Rust panic...')
            return execa(
              queryEnginePath,
              ['cli', 'debug-panic', '--message', 'FORCE_PANIC_QUERY_ENGINE_GET_DMMF'],
              execaOptions,
            )
          }

          return execa(queryEnginePath, args, execaOptions)
        },
        (e) => ({
          type: 'execa' as const,
          reason: '(query-engine binary)',
          error: e as execa.ExecaError,
        }),
      )
    })(),
    TE.map((result) => {
      const shouldRetry = result.stdout.includes('Please wait until the') && options.retry && options.retry > 0
      return { result, shouldRetry }
    }),
    TE.chainW(({ result, shouldRetry }) => {
      if (shouldRetry) {
        return TE.left({
          type: 'retry' as const,
          reason: 'Retrying after "Please wait until"',
          timeout: 5000,
        })
      }

      return TE.right({ result })
    }),
    TE.chainW(({ result }) => {
      // necessary, as sometimes the query engine prints some other stuff
      // TODO: identify when the binary does that.
      const firstCurly = result.stdout.indexOf('{')
      const stdout = result.stdout.slice(firstCurly)

      return pipe(
        E.tryCatch(
          () => JSON.parse(stdout) as DMMF.Document,
          (e) => ({
            type: 'parse-json' as const,
            reason: 'Unable to parse JSON',
            error: e as Error,
            result,
          }),
        ),
        TE.fromEither,
      )
    }),
  )

  const dmmfEither = await pipeline()

  if (E.isRight(dmmfEither)) {
    debug('dmmf retrieved without errors in getDmmfBinary')

    // Unlink only when no error occurs, as `sendPanic` might need the `tempDatamodelPath` later in case of errors.
    await unlinkTempDatamodelPath(options, tempDatamodelPath)()

    const { right: dmmf } = dmmfEither
    return dmmf
  }

  /**
   * Check which error to throw (using Either.Right), or whether to retry the whole function (using Either.Left).
   */
  const errorEither: E.Either<
    {
      type: 'retry'
      reason: string
      timeout: number
    },
    RustPanic | GetDmmfError
  > = match(dmmfEither.left)
    .with({ type: 'execa' }, (e) => {
      debugErrorType(e)

      // If the unlikely ETXTBSY event happens, try it at least once more
      if (
        e.error.message.includes('Command failed with exit code 26 (ETXTBSY)') &&
        options.retry &&
        options.retry > 0
      ) {
        return E.left({
          type: 'retry' as const,
          reason: 'Retrying because of error "ETXTBSY"',
          timeout: 500,
        })
      }

      /**
       * Capture and propagate possible Rust panics.
       */
      if (isExecaErrorCausedByRustPanic(e.error)) {
        const panic = new RustPanic(
          /* message */ e.error.shortMessage,
          /* rustStack */ e.error.stderr,
          /* request */ 'query-engine get-dmmf', // TODO: understand which type it expects
          ErrorArea.QUERY_ENGINE_BINARY_CLI,
          /* schemaPath */ options.datamodelPath ?? tempDatamodelPath,
          /* schema */ undefined,
        )
        debug(`panic in getDmmfBinary "${e.type}"`, panic)
        return E.right(panic)
      }

      /**
       * Extract the actual error by attempting to JSON-parse the output of the query-engine binary.
       */
      const errorOutput = e.error.stderr ?? e.error.stdout
      const actualError = pipe(
        E.tryCatch(
          () => JSON.parse(errorOutput),
          () => {
            debug(`Couldn't apply JSON.parse to "${errorOutput}"`)
            return new GetDmmfError({ _tag: 'unparsed', message: errorOutput, reason: e.reason })
          },
        ),
        E.map((errorOutputAsJSON: Record<string, string>) => {
          const defaultMessage = addMissingOpenSSLInfo(`${chalk.redBright(errorOutputAsJSON.message)}`)
          const { error_code: errorCode } = errorOutputAsJSON as { error_code: string | undefined }
          return new GetDmmfError({
            _tag: 'parsed',
            message: defaultMessage,
            reason: createSchemaValidationError(e.reason),
            errorCode,
          })
        }),
        E.getOrElse(identity),
      )

      return E.right(actualError)
    })
    .with({ type: 'parse-json' }, (e) => {
      debugErrorType(e)
      const message = `Problem while parsing the query engine response at ${queryEnginePath}. ${e.result.stdout}\n${e.error?.stack}`
      const error = new GetDmmfError({
        _tag: 'unparsed',
        message: message,
        reason: `${chalk.redBright.bold('JSON parsing')} - ${e.reason}\n`,
      })
      return E.right(error)
    })
    .with({ type: 'retry' }, (e) => {
      return E.left(e)
    })
    .exhaustive()

  const shouldRetry = E.isLeft(errorEither)
  if (!shouldRetry) {
    throw errorEither.right
  }

  /**
   * Handle retries.
   */
  const { timeout: retryTimeout, reason: retryReason } = errorEither.left
  debug(`Waiting "${retryTimeout}" seconds before retrying...`)
  await new Promise((resolve) => setTimeout(resolve, retryTimeout))
  debug(retryReason)
  return getDmmfBinary({ ...options, retry: (options.retry ?? 0) - 1 })
}

// TODO: should this function be used by getConfig as well?
// TODO: should we check for openssl 3?
function addMissingOpenSSLInfo(message: string) {
  if (
    message.includes(
      'debian-openssl-1.1.x: error while loading shared libraries: libssl.so.1.1: cannot open shared object file: No such file or directory',
    ) ||
    message.includes(
      'debian-openssl-1.0.x: error while loading shared libraries: libssl.so.1.0.0: cannot open shared object file: No such file or directory',
    )
  ) {
    message += `\n${chalk.green(
      `Your linux installation misses the openssl package. You can install it like so:\n`,
    )}${chalk.green.bold('apt-get -qy update && apt-get -qy install openssl')}`
  }
  return message
}

// See also removedFlags at
// https://github.com/prisma/prisma/blob/main/packages/engine-core/src/binary/BinaryEngine.ts#L174
function warnOnDeprecatedFeatureFlag(previewFeatures?: string[]) {
  const getMessage = (flag: string) =>
    `${chalk.blueBright(
      'info',
    )} The preview flag "${flag}" is not needed anymore, please remove it from your schema.prisma`

  const removedFeatureFlagMap = {
    insensitiveFilters: getMessage('insensitiveFilters'),
    atomicNumberOperations: getMessage('atomicNumberOperations'),
    connectOrCreate: getMessage('connectOrCreate'),
    transaction: getMessage('transaction'),
    nApi: getMessage('nApi'),
    transactionApi: getMessage('transactionApi'),
    uncheckedScalarInputs: getMessage('uncheckedScalarInputs'),
    nativeTypes: getMessage('nativeTypes'),
    createMany: getMessage('createMany'),
    groupBy: getMessage('groupBy'),
    referentialActions: getMessage('referentialActions'),
    microsoftSqlServer: getMessage('microsoftSqlServer'),
    selectRelationCount: getMessage('selectRelationCount'),
    orderByRelation: getMessage('orderByRelation'),
    orderByAggregateGroup: getMessage('orderByAggregateGroup'),
  }

  previewFeatures?.forEach((f) => {
    const removedMessage = removedFeatureFlagMap[f]
    if (removedMessage && !process.env.PRISMA_HIDE_PREVIEW_FLAG_WARNINGS) {
      console.warn(removedMessage)
    }
  })
}
