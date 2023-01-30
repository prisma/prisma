import Debug from '@prisma/debug'
import type { DataSource, EnvValue, GeneratorConfig } from '@prisma/generator-helper'
import chalk from 'chalk'
import * as E from 'fp-ts/Either'
import { identity, pipe } from 'fp-ts/lib/function'
import { match, P } from 'ts-pattern'

import { ErrorArea, isWasmPanic, RustPanic } from '../panic'
import { prismaFmt } from '../wasm'
import { addVersionDetailsToErrorMessage } from './errorHelpers'
import { createDebugErrorType, createSchemaValidationError } from './queryEngineCommons'

const debug = Debug('prisma:getConfig')

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
        const wasmError = e.error
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
