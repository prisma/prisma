import Debug from '@prisma/debug'
import * as E from 'fp-ts/Either'
import { bold, red } from 'kleur/colors'
import { match } from 'ts-pattern'

import { ErrorArea, getWasmError, isWasmPanic, RustPanic, WasmPanic } from '../panic'
import { prismaSchemaWasm } from '../wasm'
import { addVersionDetailsToErrorMessage } from './errorHelpers'
import { createDebugErrorType, parseQueryEngineError, QueryEngineErrorInit } from './queryEngineCommons'

const debug = Debug('prisma:serializeSchemaToBytes')

export type SerializeSchemaToBytesOptions = {
  datamodel: string
  prismaPath?: string
  datamodelPath?: string
}

export class SerializeSchemaToBytesError extends Error {
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
[Context: serializeSchemaToBytes]`

    super(addVersionDetailsToErrorMessage(errorMessageWithContext))
    this.name = 'SerializeSchemaToBytes'
  }
}

export function serializeSchemaToBytes(options: SerializeSchemaToBytesOptions): Uint8Array {
  const debugErrorType = createDebugErrorType(debug, 'serializeSchemaToBytes')

  const serializedSchemaEither = E.tryCatch(
    () => {
      if (process.env.FORCE_PANIC_QUERY_ENGINE_SERIALIZE_SCHEMA) {
        debug('Triggering a Rust panic...')
        prismaSchemaWasm.debug_panic()
      }

      const serializedSchema = prismaSchemaWasm.serialize_schema_to_bytes(options.datamodel)
      return serializedSchema
    },
    (e) => ({
      type: 'wasm-error' as const,
      reason: '(serialize_schema_to_bytes wasm)',
      error: e as Error | WasmPanic,
    }),
  )

  if (E.isRight(serializedSchemaEither)) {
    debug('config data retrieved without errors in getConfig Wasm')
    const { right: serializedSchema } = serializedSchemaEither

    return serializedSchema
  }

  /**
   * Check which error to throw.
   */
  const error = match(serializedSchemaEither.left)
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
          /* request */ '@prisma/prisma-schema-wasm serialize_schema_to_bytes',
          ErrorArea.FMT_CLI,
          /* schemaPath */ options.prismaPath,
          /* schema */ options.datamodel,
        )
        return panic
      }

      const errorOutput = e.error.message
      return new SerializeSchemaToBytesError(parseQueryEngineError({ errorOutput, reason: e.reason }))
    })
    .exhaustive()

  throw error
}
