import fs from 'fs'
import { match } from 'ts-pattern'

import { logger } from '..'
import { ErrorArea, getWasmError, RustPanic, WasmPanic } from '../panic'
import { prismaFmt } from '../wasm'
import { getLintWarningsAsText, lintSchema } from './lintSchema'

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
      const lintDiagnostics = lintSchema({ schema: formattedSchema })
      return { formattedSchema, lintDiagnostics }
    },
    { schemaPath, schema } as FormatSchemaParams,
  )

  const lintWarnings = getLintWarningsAsText(lintDiagnostics)
  if (lintWarnings && logger.should.warn()) {
    // Output warnings to stderr
    console.warn(lintWarnings)
  }

  return Promise.resolve(formattedSchema)
}

function handleFormatPanic<T>(tryCb: () => T, { schemaPath, schema }: FormatSchemaParams) {
  try {
    return tryCb()
  } catch (e: unknown) {
    const { message, stack } = getWasmError(e as WasmPanic)

    const panic = new RustPanic(
      /* message */ message,
      /* rustStack */ stack,
      /* request */ '@prisma/prisma-fmt-wasm format',
      ErrorArea.FMT_CLI,
      schemaPath,
      schema,
    )

    throw panic
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
