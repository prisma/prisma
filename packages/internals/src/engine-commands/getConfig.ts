import Debug from '@prisma/debug'
import type { DataSource, EnvValue, GeneratorConfig } from '@prisma/generator-helper'
import { getBinaryTargetForCurrentPlatform } from '@prisma/get-platform'
import * as E from 'fp-ts/Either'
import { pipe } from 'fp-ts/lib/function'
import { bold, red } from 'kleur/colors'
import { match } from 'ts-pattern'

import { ErrorArea, getWasmError, isWasmPanic, RustPanic, WasmPanic } from '../panic'
import { prismaSchemaWasm } from '../wasm'
import { addVersionDetailsToErrorMessage } from './errorHelpers'
import { createDebugErrorType, parseQueryEngineError, QueryEngineErrorInit } from './queryEngineCommons'

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
        const detailsHeader = red(bold('Details:'))
        return `${reason}
${detailsHeader} ${message}`
      })
      .exhaustive()

    const errorMessageWithContext = `${constructedErrorMessage}
[Context: getConfig]`

    super(addVersionDetailsToErrorMessage(errorMessageWithContext))
    this.name = 'GetConfigError'
  }
}

export function getEffectiveUrl(ds: DataSource): EnvValue {
  if (ds.directUrl !== undefined) return ds.directUrl

  return ds.url
}

export function getDirectUrl(ds: DataSource) {
  return ds.directUrl
}

export function resolveUrl(envValue: EnvValue | undefined) {
  const urlFromValue = envValue?.value
  const urlEnvVarName = envValue?.fromEnvVar
  const urlEnvVarValue = urlEnvVarName ? process.env[urlEnvVarName] : undefined

  return urlFromValue ?? urlEnvVarValue
}

/**
 * Wasm'd version of `getConfig`.
 */
export async function getConfig(options: GetConfigOptions): Promise<ConfigMetaFormat> {
  const debugErrorType = createDebugErrorType(debug, 'getConfigWasm')
  debug(`Using getConfig Wasm`)

  const configEither = pipe(
    E.tryCatch(
      () => {
        if (process.env.FORCE_PANIC_QUERY_ENGINE_GET_CONFIG) {
          debug('Triggering a Rust panic...')
          prismaSchemaWasm.debug_panic()
        }

        const params = JSON.stringify({
          prismaSchema: options.datamodel,
          datasourceOverrides: {},
          ignoreEnvVarErrors: options.ignoreEnvVarErrors ?? false,
          env: process.env,
        })

        const data = prismaSchemaWasm.get_config(params)
        return data
      },
      (e) => ({
        type: 'wasm-error' as const,
        reason: '(get-config wasm)',
        error: e as Error | WasmPanic,
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

    for (const generator of data.generators) {
      await resolveBinaryTargets(generator)
    }

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
          /* request */ '@prisma/prisma-schema-wasm get_config',
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

async function resolveBinaryTargets(generator: GeneratorConfig) {
  for (const binaryTarget of generator.binaryTargets) {
    // load the binaryTargets from the env var
    if (binaryTarget.fromEnvVar && process.env[binaryTarget.fromEnvVar]) {
      const value = JSON.parse(process.env[binaryTarget.fromEnvVar]!)

      if (Array.isArray(value)) {
        generator.binaryTargets = value.map((v) => ({ fromEnvVar: null, value: v }))
        await resolveBinaryTargets(generator) // resolve again if we have native
      } else {
        binaryTarget.value = value
      }
    }

    // resolve native to the current platform
    if (binaryTarget.value === 'native') {
      binaryTarget.value = await getBinaryTargetForCurrentPlatform()
      binaryTarget.native = true
    }
  }

  if (generator.binaryTargets.length === 0) {
    generator.binaryTargets = [{ fromEnvVar: null, value: await getBinaryTargetForCurrentPlatform(), native: true }]
  }
}
