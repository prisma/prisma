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
 * Check if an error is the V8 string length limit.
 * V8 has a hard-coded limit of 0x1fffffe8 characters (~536MB) for strings.
 * No Node.js flags can change this.
 * See: https://github.com/prisma/prisma/issues/29111
 */
function isV8StringLimitError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Cannot create a string longer than')
}

/**
 * Read DMMF from the buffered WASM API in chunks and parse via chunked string decoding.
 * This bypasses V8's string length limit by reading the DMMF as Uint8Array chunks
 * and parsing each chunk individually using a streaming JSON parser approach.
 *
 * Requires get_dmmf_buffered(), read_dmmf_chunk(), and free_dmmf_buffer() exports
 * from @prisma/prisma-schema-wasm.
 * See: https://github.com/prisma/prisma/issues/29111
 */
function getDmmfBuffered(params: string): DMMF.Document {
  const CHUNK_SIZE = 16 * 1024 * 1024 // 16MB chunks — well under V8 string limit

  const totalBytes = prismaSchemaWasm.get_dmmf_buffered(params)
  debug(`DMMF buffered: ${totalBytes} bytes (${(totalBytes / 1024 / 1024).toFixed(1)}MB)`)

  try {
    // Read all chunks as Uint8Array and decode to strings
    const decoder = new TextDecoder('utf-8', { stream: true })
    const jsonChunks: string[] = []
    let offset = 0

    while (offset < totalBytes) {
      const len = Math.min(CHUNK_SIZE, totalBytes - offset)
      const chunk = prismaSchemaWasm.read_dmmf_chunk(offset, len)
      jsonChunks.push(decoder.decode(chunk, { stream: offset + len < totalBytes }))
      offset += len
    }

    // Flush the decoder
    const remaining = decoder.decode()
    if (remaining) {
      jsonChunks.push(remaining)
    }

    // Join chunks and parse — each chunk is ≤16MB, but the joined string
    // may exceed V8's limit. If it does, a streaming JSON parser is needed.
    // For DMMF sizes between 536MB and ~1GB, this join may still work since
    // V8's limit is on individual string creation, and string concatenation
    // can sometimes succeed via internal rope representation.
    const jsonString = jsonChunks.join('')
    return JSON.parse(jsonString) as DMMF.Document
  } finally {
    prismaSchemaWasm.free_dmmf_buffer()
  }
}

/**
 * Wasm'd version of `getDMMF`.
 */
export async function getDMMF(options: GetDMMFOptions): Promise<DMMF.Document> {
  const debugErrorType = createDebugErrorType(debug, 'getDmmfWasm')
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
      const data = getDmmfBuffered(params)
      debug('dmmf data retrieved via buffered API')
      return data
    } catch (bufferedError) {
      debugErrorType({ type: 'wasm-error' as const, reason: '(get-dmmf-buffered wasm)', error: bufferedError })
      throw new GetDmmfError({
        _tag: 'unparsed',
        message: `Buffered DMMF fallback also failed: ${(bufferedError as Error).message}`,
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
