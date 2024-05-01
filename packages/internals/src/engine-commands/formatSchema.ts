import { logger } from '..'
import { ErrorArea, getWasmError, RustPanic, WasmPanic } from '../panic'
import { type Datamodel, schemaToStringDebug } from '../utils/datamodel'
import { prismaSchemaWasm } from '../wasm'
import { getLintWarningsAsText, lintSchema } from './lintSchema'

type FormatSchemaParams = { schema: Datamodel; schemaPath: string }

export async function formatSchema(
  { schemaPath, schema }: FormatSchemaParams,
  inputFormattingOptions?: Partial<DocumentFormattingParams['options']>,
): Promise<Datamodel> {
  if (!schema && !schemaPath) {
    throw new Error(`Parameter schema or schemaPath must be passed.`)
  }

  if (process.env.FORCE_PANIC_PRISMA_SCHEMA) {
    handleFormatPanic(
      () => {
        prismaSchemaWasm.debug_panic()
      },
      { schemaPath, schema } as FormatSchemaParams,
    )
  }

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
  const { formattedDatamodel, lintDiagnostics } = handleFormatPanic(
    () => {
      // the only possible error here is a Rust panic
      const formattedDatamodelRaw = formatWasm(JSON.stringify(schema), documentFormattingParams)
      const formattedDatamodel = JSON.parse(formattedDatamodelRaw) as Datamodel

      const lintDiagnostics = lintSchema({ schema: formattedDatamodel })
      return { formattedDatamodel, lintDiagnostics }
    },
    { schemaPath, schema } as FormatSchemaParams,
  )

  const lintWarnings = getLintWarningsAsText(lintDiagnostics)
  if (lintWarnings && logger.should.warn()) {
    // Output warnings to stderr
    console.warn(lintWarnings)
  }

  return Promise.resolve(formattedDatamodel)
}

function handleFormatPanic<T>(tryCb: () => T, { schemaPath, schema }: FormatSchemaParams) {
  try {
    return tryCb()
  } catch (e: unknown) {
    const { message, stack } = getWasmError(e as WasmPanic)

    const panic = new RustPanic(
      /* message */ message,
      /* rustStack */ stack,
      /* request */ '@prisma/prisma-schema-wasm format',
      ErrorArea.FMT_CLI,
      schemaPath,
      /* schema */ schemaToStringDebug(schema),
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
  const formattedSchema = prismaSchemaWasm.format(schema, JSON.stringify(documentFormattingParams))
  return formattedSchema
}
