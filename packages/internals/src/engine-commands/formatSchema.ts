import Debug from '@prisma/debug'
import fs from 'fs'

import { prismaFmt as prismaFmtWASM } from '../wasm'

const debug = Debug('prisma:formatSchema')

// can be used by passing either
// the schema as a string
// or a path to the schema file
export async function formatSchema({ schema }: { schema: string })
export async function formatSchema({ schemaPath }: { schemaPath: string })
export async function formatSchema({ schemaPath, schema }: { schemaPath?: string; schema?: string }): Promise<string> {
  if (!schema && !schemaPath) {
    throw new Error(`Parameter schema or schemaPath must be passed.`)
  }

  if (process.env.FORCE_PANIC_PRISMA_FMT) {
    // TODO: this prints something like `${chalk.red('Error:')} unreachable`
    prismaFmtWASM.debug_panic()
  }

  let schemaString: string | undefined = schema
  if (schemaPath) {
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema at ${schemaPath} does not exist.`)
    }

    schemaString = fs.readFileSync(schemaPath, { encoding: 'utf8' })
  }

  const formattedSchema = await format(schemaString || schema || '')
  return formattedSchema
}

// Part of the LSP spec: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#documentFormattingParams
// These are only the parts we are interested in.
type DocumentFormattingParams = {
  options: {
    tabSize: number
    insertSpaces: boolean
  }
}
const defaultDocumentFormattingParams: DocumentFormattingParams = { options: { tabSize: 4, insertSpaces: true } }

async function format(
  schema: string,
  params: DocumentFormattingParams = defaultDocumentFormattingParams,
): Promise<string> {
  const formattedSchema = prismaFmtWASM.format(schema, JSON.stringify(params))
  debug.log(`Formatted schema:\n${formattedSchema}`)

  return Promise.resolve(formattedSchema)
}
