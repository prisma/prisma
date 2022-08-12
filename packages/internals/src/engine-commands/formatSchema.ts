import Debug from '@prisma/debug'
import fs from 'fs'
import { match } from 'ts-pattern'

import { ErrorArea, RustPanic } from '../panic'
import { prismaFmt } from '../wasm'

const debug = Debug('prisma:formatSchema')

type FormatSchemaParams = { schema: string; schemaPath?: never } | { schema?: never; schemaPath: string }

function isSchemaOnly(schemaParams: FormatSchemaParams): schemaParams is { schema: string; schemaPath?: never } {
  return !!schemaParams.schema
}

function isSchemaPathOnly(schemaParams: FormatSchemaParams): schemaParams is { schema?: never; schemaPath: string } {
  return !!schemaParams.schemaPath
}

/**
 * Can be used by passing either the `schema` as a string, or a path `schemaPath` to the schema file.
 * Passing `schema` will use the Rust binary, passing `schemaPath` will use the WASM engine.
 * Currently, we only use `schemaPath` in the cli. Do we need to keep supporting `schema` as well?
 */
export async function formatSchema({ schemaPath, schema }: FormatSchemaParams): Promise<string> {
  if (!schema && !schemaPath) {
    throw new Error(`Parameter schema or schemaPath must be passed.`)
  }

  if (process.env.FORCE_PANIC_PRISMA_FMT) {
    // TODO: this prints something like `${chalk.red('Error:')} unreachable`.
    // Is it still useful to have this?
    prismaFmt.debug_panic()
  }

  const schemaContent = match({ schema, schemaPath } as FormatSchemaParams)
    .when(isSchemaOnly, ({ schema: _schema }) => {
      debug('using a schema string directly')
      return _schema
    })
    .when(isSchemaPathOnly, ({ schemaPath: _schemaPath }) => {
      debug('reading a schema from a file')

      if (!fs.existsSync(_schemaPath)) {
        throw new Error(`Schema at ${schemaPath} does not exist.`)
      }

      const _schema = fs.readFileSync(_schemaPath, { encoding: 'utf8' })
      return _schema
    })
    .exhaustive()

  try {
    const formattedSchema = await formatWASM(schemaContent)
    return formattedSchema
  } catch (e: unknown) {
    // the only possible error here is a Rust panic
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
    // The WASM formatter may fail silently on unmarshaling errors (a `warn!` macro is used in the Rust code, but that's not propagated to WASM land).
    tabSize: number

    insertSpaces: boolean
  }
}

const defaultDocumentFormattingParams: DocumentFormattingParams = {
  textDocument: { uri: 'file:/dev/null' },
  options: {
    tabSize: 2,
    insertSpaces: true,
  },
}

async function formatWASM(schema: string): Promise<string> {
  const params: DocumentFormattingParams = defaultDocumentFormattingParams
  const formattedSchema = prismaFmt.format(schema, JSON.stringify(params))
  return Promise.resolve(formattedSchema)
}
