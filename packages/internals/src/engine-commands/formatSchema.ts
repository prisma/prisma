import Debug from '@prisma/debug'
import prismaFmtWASM from '@prisma/prisma-fmt-wasm'
import fs from 'fs'

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
    prismaFmtWASM.debug_panic()
  }

  let schemaString: string | undefined = schema
  if (schemaPath) {
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema at ${schemaPath} does not exist.`)
    }

    // due to @typescript-eslint/require-await
    schemaString = await fs.promises.readFile(schemaPath, 'utf8')
  }

  return format(schemaString || schema || '')
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

function format(schema: string, params: DocumentFormattingParams = defaultDocumentFormattingParams): string {
  return prismaFmtWASM.format(schema, JSON.stringify(params))
}
