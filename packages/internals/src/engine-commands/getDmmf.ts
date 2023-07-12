import Debug from '@prisma/debug'
import type { DataSource, DMMF, GeneratorConfig } from '@prisma/generator-helper'
import * as E from 'fp-ts/Either'
import { pipe } from 'fp-ts/lib/function'
import * as TE from 'fp-ts/TaskEither'
import fs from 'fs'
import { blue, bold, red } from 'kleur/colors'
import { match } from 'ts-pattern'

import { ErrorArea, getWasmError, isWasmPanic, RustPanic, WasmPanic } from '../panic'
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
  datamodel?: string
  cwd?: string
  prismaPath?: string
  datamodelPath?: string
  retry?: number
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
  // TODO: substitute this warning with `prismaSchemaWasm.lint()`.
  // See https://github.com/prisma/prisma/issues/16538
  warnOnDeprecatedFeatureFlag(options.previewFeatures)

  const debugErrorType = createDebugErrorType(debug, 'getDmmfWasm')
  debug(`Using getDmmf Wasm`)

  const dmmfPipeline = pipe(
    TE.tryCatch(
      () => {
        if (options.datamodel) {
          debug('Using given datamodel')
          return Promise.resolve(options.datamodel)
        }

        debug(`Reading datamodel from the given datamodel path ${options.datamodelPath!}`)
        return fs.promises.readFile(options.datamodelPath!, { encoding: 'utf-8' })
      },
      (e) =>
        ({
          type: 'read-datamodel-path' as const,
          reason: 'Error while trying to read the datamodel path',
          error: e as Error,
          datamodelPath: options.datamodelPath,
        } as const),
    ),
    TE.chainW((datamodel) => {
      return pipe(
        E.tryCatch(
          () => {
            if (process.env.FORCE_PANIC_QUERY_ENGINE_GET_DMMF) {
              debug('Triggering a Rust panic...')
              prismaSchemaWasm.debug_panic()
            }

            const params = JSON.stringify({
              prismaSchema: datamodel,
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
        TE.fromEither,
      )
    }),
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
    .with({ type: 'read-datamodel-path' }, (e) => {
      debugErrorType(e)
      return new GetDmmfError({
        _tag: 'unparsed',
        message: `${e.error.message}\nDatamodel path: "${e.datamodelPath}"`,
        reason: e.reason,
      })
    })
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
          /* schemaPath */ options.prismaPath,
          /* schema */ options.datamodel,
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

// See also removedFlags at
// https://github.com/prisma/prisma/blob/main/packages/client/src/runtime/core/engine/BinaryEngine.ts
function warnOnDeprecatedFeatureFlag(previewFeatures?: string[]) {
  const getMessage = (flag: string) =>
    `${blue(bold('info'))} The preview flag "${flag}" is not needed anymore, please remove it from your schema.prisma`

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
