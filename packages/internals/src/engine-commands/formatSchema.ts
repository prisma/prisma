import chalk from 'chalk'
import fs from 'fs'
import { match } from 'ts-pattern'

import { ErrorArea, RustPanic } from '../panic'
import { prismaFmt } from '../wasm'
import { getLintWarnings, lintSchema, warningToString } from './lintSchema'

type FormatSchemaParams = { schema: string; schemaPath?: never } | { schema?: never; schemaPath: string }

function isSchemaOnly(schemaParams: FormatSchemaParams): schemaParams is { schema: string; schemaPath?: never } {
  return Boolean(schemaParams.schema)
}

function isSchemaPathOnly(schemaParams: FormatSchemaParams): schemaParams is { schema?: never; schemaPath: string } {
  return Boolean(schemaParams.schemaPath)
}

/**
 * Can be used by passing either the `schema` as a string, or a path `schemaPath` to the schema file.
 * Currently, we only use `schemaPath` in the cli. Do we need to keep supporting `schema` as well?
 */
export async function formatSchema(
  { schemaPath, schema }: FormatSchemaParams,
  inputFormattingOptions?: Partial<DocumentFormattingParams['options']>,
): Promise<string> {
  if (!schema && !schemaPath) {
    throw new Error(`Parameter schema or schemaPath must be passed.`)
  }

  if (process.env.FORCE_PANIC_PRISMA_FMT) {
    handleFormatPanic(
      () => {
        prismaFmt.debug_panic()
      },
      { schemaPath, schema } as FormatSchemaParams,
    )
  }

  const schemaContent = match({ schema, schemaPath } as FormatSchemaParams)
    .when(isSchemaOnly, ({ schema: _schema }) => _schema)
    .when(isSchemaPathOnly, ({ schemaPath: _schemaPath }) => {
      if (!fs.existsSync(_schemaPath)) {
        throw new Error(`Schema at ${schemaPath} does not exist.`)
      }

      const _schema = fs.readFileSync(_schemaPath, { encoding: 'utf8' })
      return _schema
    })
    .exhaustive()

  const defaultFormattingOptions: DocumentFormattingParams['options'] = {
    tabSize: 2,
    insertSpaces: true,
  }

  const documentFormattingParams = {
    textDocument: { uri: 'file:/dev/null' },
    options: {
      ...defaultFormattingOptions,
      ...inputFormattingOptions,
    },
  } as DocumentFormattingParams

  /**
   * Note:
   * - Given an invalid schema, `formatWasm` returns a formatted schema regardless (when it doesn't panic).
   * - Given an invalid schema, `lintSchema` returns a list of warnings/errors regardless (when it doesn't panic).
   *   Warnings must be filtered out from the other diagnostics.
   * - Validation errors aren't checked/shown here.
   *   They appear when calling `getDmmf` on the formatted schema in Format.ts.
   *   If we called `getConfig` instead, we wouldn't have any validation check.
   */
  const { formattedSchema, lintDiagnostics } = handleFormatPanic(
    () => {
      // the only possible error here is a Rust panic
      const formattedSchema = formatWasm(schemaContent, documentFormattingParams)
      const lintDiagnostics = lintSchema(formattedSchema)
      return { formattedSchema, lintDiagnostics }
    },
    { schemaPath, schema } as FormatSchemaParams,
  )

  /*
   * Display warnings, if any.
   *
   * Note:
   * - We don't get a nice warning message output with colors and line numbers for free, as we would with errors detected by `getDmmf`.
   *   I.e., there's not such thing for warnings out of the box as the following:
   *     -->  schema.prisma:18
   *      |
   *   17 |   id     Int      @id
   *   18 |   user   SomeUser @relation(fields: [userId], references: [id], onUpdate: SetNull, onDelete: SetNull)
   *   19 |   userId Int      @unique
   *      |
   *
   * Questions:
   * 1) should warnings still be displayed in case of errors?
   */
  const lintWarnings = getLintWarnings(lintDiagnostics)

  if (lintWarnings.length > 0) {
    console.warn(chalk.yellow(`\nPrisma schema warning${lintWarnings.length > 1 ? 's' : ''}:`))
    for (const warning of lintWarnings) {
      console.warn(warningToString(warning))
    }
  }

  return Promise.resolve(formattedSchema)
}

function handleFormatPanic<T>(tryCb: () => T, { schemaPath, schema }: FormatSchemaParams) {
  try {
    return tryCb()
  } catch (e: unknown) {
    const wasmError = e as Error
    throw new RustPanic(
      /* message */ wasmError.message,
      /* rustStack */ wasmError.stack || 'NO_BACKTRACE',
      /* request */ '@prisma/prisma-fmt-wasm format',
      ErrorArea.FMT_CLI,
      schemaPath,
      schema,
    )
  }
}

type DocumentUri = string

type TextDocument = {
  /**
   * The associated URI for this document. Most documents have the __file__-scheme, indicating that they
   * represent files on disk. However, some documents may have other schemes indicating that they are not
   * available on disk.
   */
  readonly uri: DocumentUri
}

// Part of the LSP spec: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#documentFormattingParams
// These are only the parts we are interested in.
type DocumentFormattingParams = {
  textDocument: TextDocument
  options: {
    // this is the only property currently considered by Rust, the rest are ignored but are needed for successfully unmarshaling the `DocumentFormattingParams`
    // and be compatible with the LSP spec.
    // The Wasm formatter may fail silently on unmarshaling errors (a `warn!` macro is used in the Rust code, but that's not propagated to Wasm land).
    tabSize: number
    insertSpaces: boolean
  }
}

function formatWasm(schema: string, documentFormattingParams: DocumentFormattingParams): string {
  const formattedSchema = prismaFmt.format(schema, JSON.stringify(documentFormattingParams))
  return formattedSchema
}
