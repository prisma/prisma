import Debug from '@prisma/debug'
import type { DataSource, DMMF, GeneratorConfig } from '@prisma/generator-helper'
import chalk from 'chalk'
import * as E from 'fp-ts/Either'
import { pipe } from 'fp-ts/lib/function'
import { match } from 'ts-pattern'

import { ErrorArea, isWasmPanic, RustPanic, WasmPanic } from '../panic'
import { prismaFmt } from '../wasm'
import { addVersionDetailsToErrorMessage } from './errorHelpers'
import { createDebugErrorType, createSchemaValidationError } from './queryEngineCommons'

const debug = Debug('prisma:getDMMF')

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
  // TODO: substitute this warning with `prismaFmt.lint()`
  warnOnDeprecatedFeatureFlag(options.previewFeatures)

  const dmmf = await getDmmfWasm(options)
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
      (e) =>
        ({
          type: 'wasm-error' as const,
          reason: '(get-dmmf wasm)',
          error: e as string | WasmPanic,
        } as const),
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
      if (isWasmPanic<string>(e.error)) {
        const wasmError = e.error
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
      const errorOutput = e.error
      const actualError = new GetDmmfError({
        _tag: 'parsed',
        message: errorOutput,
        reason: createSchemaValidationError(e.reason),
        errorCode: 'P1012',
      })

      return actualError
    })
    .with({ type: 'parse-json' }, (e) => {
      debugErrorType(e)
      return new GetDmmfError({ _tag: 'unparsed', message: e.error.message, reason: e.reason })
    })
    .exhaustive()

  throw error
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
