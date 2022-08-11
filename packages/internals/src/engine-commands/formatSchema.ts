import Debug from '@prisma/debug'
import { BinaryType } from '@prisma/fetch-engine'
import execa from 'execa'
import fs from 'fs'
import { match } from 'ts-pattern'

import { resolveBinary } from '../resolveBinary'
import { prismaFmt } from '../wasm'

const debug = Debug('prisma:formatSchema')

const MAX_BUFFER = 1_000_000_000

type FormatSchemaParams = { schema: string; schemaPath?: never } | { schema?: never; schemaPath: string }

function isSchemaOnly(schemaParams: FormatSchemaParams): schemaParams is { schema: string; schemaPath?: never } {
  return !!schemaParams.schema
}

function isSchemaPathOnly(schemaParams: FormatSchemaParams): schemaParams is { schema?: never; schemaPath: string } {
  return !!schemaParams.schemaPath
}

// can be used by passing either
// the schema as a string
// or a path to the schema file
// TODO: currently, we only use `schemaPath` in the cli
export async function formatSchema({ schemaPath, schema }: FormatSchemaParams): Promise<string> {
  if (!schema && !schemaPath) {
    throw new Error(`Parameter schema or schemaPath must be passed.`)
  }

  if (process.env.FORCE_PANIC_PRISMA_FMT) {
    // TODO: this prints something like `${chalk.red('Error:')} unreachable`.
    // Is it still useful to have this?
    prismaFmt.debug_panic()
  }

  const formattedSchema = await match({ schema, schemaPath } as FormatSchemaParams)
    .when(isSchemaOnly, async ({ schema: _schema }) => {
      debug('using a schema string directly')

      const prismaFmtPath = await resolveBinary(BinaryType.prismaFmt)
      const showColors = !process.env.NO_COLOR && process.stdout.isTTY
      const options = {
        env: {
          RUST_BACKTRACE: process.env.RUST_BACKTRACE ?? '1',
          ...(showColors ? { CLICOLOR_FORCE: '1' } : {}),
        },
        maxBuffer: MAX_BUFFER,
      } as execa.Options
      const result = await execa(prismaFmtPath, ['format'], {
        ...options,
        input: schema,
      })

      return result.stdout
    })
    .when(isSchemaPathOnly, async ({ schemaPath: _schemaPath }) => {
      debug('reading a schema from a file')

      if (!fs.existsSync(_schemaPath)) {
        throw new Error(`Schema at ${schemaPath} does not exist.`)
      }
      const _schema = await fs.promises.readFile(_schemaPath, { encoding: 'utf8' })
      return await formatWASM(_schema)
    })
    .exhaustive()

  debug(`formatted schema:\n${formattedSchema}`)

  return formattedSchema
}

// Part of the LSP spec: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#documentFormattingParams
// These are only the parts we are interested in.
type DocumentFormattingParams = {
  options: {
    tabSize: number // this is the only property currently considered by Rust
    insertSpaces: boolean
  }
}

const defaultDocumentFormattingParams: DocumentFormattingParams = {
  options: {
    tabSize: 4,
    insertSpaces: true,
  },
}

async function formatWASM(schema: string): Promise<string> {
  const params: DocumentFormattingParams = defaultDocumentFormattingParams
  const formattedSchema = prismaFmt.format(schema, JSON.stringify(params))
  return Promise.resolve(formattedSchema)
}
