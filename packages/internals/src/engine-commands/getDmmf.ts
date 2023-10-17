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

  // ... rest of the code for getDMMF ...

  throw error
}

function warnOnDeprecatedFeatureFlag(previewFeatures?: string[]) {
  // List of deprecated feature flags
  const deprecatedFlags = [
    'insensitiveFilters',
    'atomicNumberOperations',
    'connectOrCreate',
    'transaction',
    'nApi',
    'transactionApi',
    'uncheckedScalarInputs',
    'nativeTypes',
    'createMany',
    'groupBy',
    'referentialActions',
    'microsoftSqlServer',
    'selectRelationCount',
    'orderByRelation',
    'orderByAggregateGroup',
  ];

  const getMessage = (flag: string) =>
    `${blue(bold('info'))} The preview flag "${flag}" is not needed anymore, please remove it from your schema.prisma`;

  previewFeatures?.forEach((f) => {
    if (deprecatedFlags.includes(f) && !process.env.PRISMA_HIDE_PREVIEW_FLAG_WARNINGS) {
      console.warn(getMessage(f));
    }
  });
}
