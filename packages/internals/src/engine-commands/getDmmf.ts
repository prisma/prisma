import Debug from '@prisma/debug'
import type * as DMMF from '@prisma/dmmf'
import type { DataSource, GeneratorConfig } from '@prisma/generator'
import { JSONParser } from '@streamparser/json'
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
const debugErrorType = createDebugErrorType(debug, 'getDmmfWasm')

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
 * Check if an error is the V8 string length limit.
 * V8 has a hard-coded limit of 0x1fffffe8 characters (~536MB) for strings.
 * No Node.js flags can change this.
 * See: https://github.com/prisma/prisma/issues/29111
 */
function isV8StringLimitError(error: unknown): error is Error & { code: 'ERR_STRING_TOO_LONG' } {
  return error instanceof Error && 'code' in error && error.code === 'ERR_STRING_TOO_LONG'
}

/**
 * Read DMMF from the handle-based buffered WASM API in chunks and parse via
 * chunked string decoding. This bypasses V8's string length limit by reading
 * the DMMF as Uint8Array chunks from a caller-owned DmmfBuffer handle.
 *
 * Requires `get_dmmf_buffered()` (returns a `DmmfBuffer` handle) from
 * `@prisma/prisma-schema-wasm`. The handle exposes `.len()`, `.read_chunk()`,
 * and `.free()` — no implicit global state.
 *
 * See: https://github.com/prisma/prisma/issues/29111
 */
function getDMMFBuffered(params: string): DMMF.Document {
  const CHUNK_SIZE = 16 * 1024 * 1024 // 16MB chunks — well under V8 string limit

  if (typeof prismaSchemaWasm.get_dmmf_buffered !== 'function') {
    throw new Error(
      "Buffered DMMF API not available. It's required for schemas that do not fit within the default V8 memory limit. Ensure you are using latest @prisma/prisma-schema-wasm.",
    )
  }

  const buffer = prismaSchemaWasm.get_dmmf_buffered(params)

  try {
    const totalBytes = buffer.len()
    debug(`DMMF buffered: ${totalBytes} bytes (${(totalBytes / 1024 / 1024).toFixed(1)}MB)`)

    // Use a streaming JSON parser that processes Uint8Array chunks directly,
    // never creating a single large string.
    const parser = new JSONParser()
    let result: DMMF.Document | undefined

    parser.onValue = ({ value, stack }) => {
      if (stack.length === 0 && value !== undefined) {
        result = value as unknown as DMMF.Document
      }
    }

    let offset = 0
    while (offset < totalBytes) {
      const len = Math.min(CHUNK_SIZE, totalBytes - offset)
      const chunk = buffer.read_chunk(offset, len)
      parser.write(chunk)
      offset += len
    }

    if (result === undefined) {
      throw new Error('Streaming JSON parse produced no result')
    }

    debug(`DMMF parsed via streaming parser (${(totalBytes / 1024 / 1024).toFixed(1)}MB)`)
    return result
  } finally {
    buffer.free()
  }
}

/**
 * Wasm'd version of `getDMMF`.
 */
export async function getDMMF(options: GetDMMFOptions): Promise<DMMF.Document> {
  debug(`Using getDmmf Wasm`)

  const params = JSON.stringify({
    prismaSchema: options.datamodel,
    noColor: Boolean(process.env.NO_COLOR),
  })

  const dmmfPipeline = pipe(
    E.tryCatch(
      () => {
        if (process.env.FORCE_PANIC_GET_DMMF) {
          debug('Triggering a Rust panic...')
          prismaSchemaWasm.debug_panic()
        }

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
   * If the error is a V8 string length limit, fall back to the buffered DMMF API.
   * This bypasses the limit by reading DMMF as chunked Uint8Array data instead of
   * a single JS string.
   * See: https://github.com/prisma/prisma/issues/29111
   */
  const leftError = dmmfEither.left
  if (leftError.type === 'wasm-error' && isV8StringLimitError(leftError.error)) {
    debug('V8 string limit hit, falling back to buffered DMMF API')

    try {
      const data = getDMMFBuffered(params)
      debug('dmmf data retrieved via buffered API')
      return data
    } catch (error) {
      if (error instanceof Error) {
        debugErrorType({ type: 'wasm-error' as const, reason: '(get-dmmf-buffered wasm)', error })
        throw mapWasmPanicToGetDmmfError(error, '(get-dmmf-buffered wasm)')
      }

      throw new GetDmmfError({
        _tag: 'unparsed',
        message: `Unknown error during buffered DMMF retrieval: ${error}`,
        reason: '(get-dmmf-buffered wasm)',
      })
    }
  }

  /**
   * Check which error to throw.
   */
  const error = match(dmmfEither.left)
    .with({ type: 'wasm-error' }, (e) => {
      debugErrorType(e)
      return mapWasmPanicToGetDmmfError(e.error, e.reason)
    })
    .with({ type: 'parse-json' }, (e) => {
      debugErrorType(e)
      return new GetDmmfError({ _tag: 'unparsed', message: e.error.message, reason: e.reason })
    })
    .exhaustive()

  throw error
}

function mapWasmPanicToGetDmmfError(error: Error | WasmPanic, reason: string): GetDmmfError {
  /**
   * Capture and propagate possible Wasm panics.
   */
  if (isWasmPanic(error)) {
    const { message, stack } = getWasmError(error)

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
  const errorOutput = error.message
  return new GetDmmfError(parseQueryEngineError({ errorOutput, reason }))
}
