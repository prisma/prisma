import Debug from '@prisma/debug'
import fs from 'fs'
import prismaFmt from '@prisma/prisma-fmt-wasm'

import { resolveBinary } from '../resolveBinary'

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
      prismaFmt.debug_panic()
  }

  let schemaString: string | undefined = schema
  if (schemaPath) {
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema at ${schemaPath} does not exist.`)
    }
    schemaString = fs.readFileSync(schemaPath, "utf8");
  }

  return format(schemaString || '')
}

// Part of the LSP spec: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#documentFormattingParams
// This is only the parts we are interested in.
interface DocumentFormattingParams {
    options: {
        tabSize: number
        insertSpaces: boolean
    }
}

const defaultDocumentFormattingParams: DocumentFormattingParams = { options: { tabSize: 4, insertSpaces: true } }

function format(schema: string, params: DocumentFormattingParams = defaultDocumentFormattingParams): string {
    return prismaFmt.format(schema, JSON.stringify(params))
}
