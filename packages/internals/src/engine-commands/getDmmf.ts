import Debug from '@prisma/debug'
import type * as DMMF from '@prisma/dmmf'
import type { DataSource, GeneratorConfig } from '@prisma/generator'
import * as E from 'fp-ts/Either'
import { pipe } from 'fp-ts/lib/function'
import * as TE from 'fp-ts/TaskEither'
import { bold, red } from 'kleur/colors'
import { match } from 'ts-pattern'

import { ErrorArea, getWasmError, isWasmPanic, RustPanic, WasmPanic } from '../panic'
import { type SchemaFileInput } from '../utils/schemaFileInput'
import { prismaSchemaWasm } from '../wasm'
import { addVersionDetailsToErrorMessage } from './errorHelpers'
import { createDebugErrorType, parseQueryEngineError, QueryEngineErrorInit } from './queryEngineCommons'

const debug = Debug('prisma:getDMMF')

export interface ConfigMetaFormat {
  datasources: DataSource[]
  generators: GeneratorConfig[]
  warnings: string[]
}

export type GetDMMFOptions = {
  datamodel: SchemaFileInput
  previewFeatures?: string[]
}

export class GetDmmfError extends Error {
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
[Context: getDmmf]`

    super(addVersionDetailsToErrorMessage(errorMessageWithContext))
    this.name = 'GetDmmfError'
  }
}

/**
 * Wasm'd version of `getDMMF`.
 */
export async function getDMMF(options: GetDMMFOptions): Promise<DMMF.Document> {
  const debugErrorType = createDebugErrorType(debug, 'getDmmfWasm')
  debug(`Using getDmmf Wasm`)

  const dmmfPipeline = pipe(
    E.tryCatch(
      () => {
        if (process.env.FORCE_PANIC_GET_DMMF) {
          debug('Triggering a Rust panic...')
          prismaSchemaWasm.debug_panic()
        }

        const params = JSON.stringify({
          prismaSchema: options.datamodel,
          noColor: Boolean(process.env.NO_COLOR),
        })
        const data = prismaSchemaWasm.get_dmmf(params)
        return data
      },
      (e) =>
        ({
          type: 'wasm-error' as const,
          reason: '(get-dmmf wasm)',
          error: e as Error | WasmPanic,
        }) as const,
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
    TE.fromEither,
  )

  const dmmfEither = await dmmfPipeline()

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
        const { message, stack } = getWasmError(e.error)

        const panic = new RustPanic(
          /* message */ message,
          /* rustStack */ stack,
          /* request */ '@prisma/prisma-schema-wasm get_dmmf',
          ErrorArea.FMT_CLI,
        )
        return panic
      }

      /*
       * Extract the actual error by attempting to JSON-parse the error message.
       */
      const errorOutput = e.error.message
      return new GetDmmfError(parseQueryEngineError({ errorOutput, reason: e.reason }))
    })
    .with({ type: 'parse-json' }, (e) => {
      debugErrorType(e)
      return new GetDmmfError({ _tag: 'unparsed', message: e.error.message, reason: e.reason })
    })
    .exhaustive()

  throw error
}
