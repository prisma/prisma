import Debug from '@prisma/debug'
import type { DataSource, EnvValue } from '@prisma/generator-helper'
import chalk from 'chalk'
import * as E from 'fp-ts/Either'
import { pipe } from 'fp-ts/lib/function'
import { match } from 'ts-pattern'

import { ErrorArea, getWasmError, isWasmPanic, RustPanic, WasmPanic } from '../panic'
import { prismaFmt } from '../wasm'
import { addVersionDetailsToErrorMessage } from './errorHelpers'
import { createDebugErrorType, parseQueryEngineError, QueryEngineErrorInit } from './queryEngineCommons'

export type ConfigMetaFormat = prismaFmt.ConfigMetaFormat

const debug = Debug('prisma:getConfig')

export type GetConfigOptions = {
  datamodel: string
  cwd?: string
  prismaPath?: string
  datamodelPath?: string
  retry?: number
  ignoreEnvVarErrors?: boolean
}

export class GetConfigError extends Error {
  constructor(params: QueryEngineErrorInit) {
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

/**
 * Wasm'd version of `getConfig`.
 */
export async function getConfig(options: GetConfigOptions): Promise<prismaFmt.ConfigMetaFormat> {
  const debugErrorType = createDebugErrorType(debug, 'getConfigWasm')
  debug(`Using getConfig Wasm`)

  const configEither = pipe(
    E.tryCatch(
      () => {
        if (process.env.FORCE_PANIC_QUERY_ENGINE_GET_CONFIG) {
          debug('Triggering a Rust panic...')
          prismaFmt.debug_panic()
        }

        const params = {
          prismaSchema: options.datamodel,
          datasourceOverrides: {},
          ignoreEnvVarErrors: options.ignoreEnvVarErrors ?? false,

          // TODO: env is Record<string, string | undefined>, change Rust's tsify
          env: process.env as Record<string, string>,
        }

        const data = prismaFmt.get_config(params)
        return data
      },
      (e) => ({
        type: 'wasm-error' as const,
        reason: '(get-config wasm)',
        error: e as Error | WasmPanic,
      }),
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
        const { message, stack } = getWasmError(e.error)

        const panic = new RustPanic(
          /* message */ message,
          /* rustStack */ stack,
          /* request */ '@prisma/prisma-fmt-wasm get_config',
          ErrorArea.FMT_CLI,
          /* schemaPath */ options.prismaPath,
          /* schema */ options.datamodel,
        )
        return panic
      }

      const errorOutput = e.error.message
      return new GetConfigError(parseQueryEngineError({ errorOutput, reason: e.reason }))
    })
    .otherwise((e) => {
      debugErrorType(e)
      return new GetConfigError({ _tag: 'unparsed', message: e.error.message, reason: e.reason })
    })

  throw error
}
