import Debug from '@prisma/debug'
import chalk from 'chalk'
import * as E from 'fp-ts/Either'
import { pipe } from 'fp-ts/lib/function'
import { match } from 'ts-pattern'

import { ErrorArea, getWasmError, isWasmPanic, RustPanic, WasmPanic } from '../panic'
import { prismaFmt } from '../wasm'
import { addVersionDetailsToErrorMessage } from './errorHelpers'
import { createDebugErrorType, parseQueryEngineError, QueryEngineErrorInit } from './queryEngineCommons'

const debug = Debug('prisma:validate')

export type ValidateOptions = {
  datamodel: string
}

export class ValidateError extends Error {
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
[Context: validate]`

    super(addVersionDetailsToErrorMessage(errorMessageWithContext))
  }
}

/**
 * Wasm'd version of `validate`.
 */
export function validate(options: ValidateOptions): void {
  const debugErrorType = createDebugErrorType(debug, 'validateWasm')
  debug(`Using validate Wasm`)

  const validateEither = pipe(
    E.tryCatch(
      () => {
        /**
         * Note: `validate` was introduced as a substitute of `getDMMF` to validate schemas the
         * same way `getDMMF` did, but without the expensive DMMF document computation, so we
         * keep using `FORCE_PANIC_QUERY_ENGINE_GET_DMMF` to avoid breaking changes in env vars.
         */
        if (process.env.FORCE_PANIC_QUERY_ENGINE_GET_DMMF) {
          debug('Triggering a Rust panic...')
          prismaFmt.debug_panic()
        }

        const noColor = Boolean(process.env.NO_COLOR)
        const params = JSON.stringify({
          prismaSchema: options.datamodel,
          noColor,
        })
        prismaFmt.validate(params)
      },
      (e) =>
        ({
          type: 'wasm-error' as const,
          reason: '(validate wasm)',
          error: e as Error | WasmPanic,
        } as const),
    ),
  )

  if (E.isRight(validateEither)) {
    return
  }

  /**
   * Check which error to throw.
   */
  const error = match(validateEither.left)
    .with({ type: 'wasm-error' }, (e) => {
      debugErrorType(e)

      console.error('') // empty line for better readability

      /**
       * Capture and propagate possible Wasm panics.
       */
      if (isWasmPanic(e.error)) {
        const { message, stack } = getWasmError(e.error)
        const panic = new RustPanic(
          /* message */ message,
          /* rustStack */ stack,
          /* request */ '@prisma/prisma-fmt-wasm validate',
          ErrorArea.FMT_CLI,
          /* schemaPath */ undefined,
          /* schema */ options.datamodel,
        )
        return panic
      }

      /*
       * Extract the actual error by attempting to JSON-parse the error message.
       */
      const errorOutput = e.error.message
      return new ValidateError(parseQueryEngineError({ errorOutput, reason: e.reason }))
    })
    .exhaustive()

  throw error
}
