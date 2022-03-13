import Debug from '@prisma/debug'
import { EngineType } from '@prisma/fetch-engine'
import execa from 'execa'
import fs from 'fs'

import { resolveEnginePath } from '../resolveEnginePath'

const debug = Debug('prisma:formatSchema')

const MAX_BUFFER = 1_000_000_000

// can be used by passing either
// the schema as a string
// or a path to the schema file
export async function formatSchema({ schema }: { schema: string })
export async function formatSchema({ schemaPath }: { schemaPath: string })
export async function formatSchema({ schemaPath, schema }: { schemaPath?: string; schema?: string }): Promise<string> {
  if (!schema && !schemaPath) {
    throw new Error(`Parameter schema or schemaPath must be passed.`)
  }

  const prismaFmtPath = await resolveEnginePath(EngineType.prismaFmt)
  const showColors = !process.env.NO_COLOR && process.stdout.isTTY

  const options = {
    env: {
      RUST_BACKTRACE: '1',
      ...(showColors ? { CLICOLOR_FORCE: '1' } : {}),
    },
    maxBuffer: MAX_BUFFER,
  } as execa.Options

  let result
  if (schemaPath) {
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema at ${schemaPath} does not exist.`)
    }
    result = await execa(prismaFmtPath, ['format', '-i', schemaPath], options)
  } else if (schema) {
    result = await execa(prismaFmtPath, ['format'], {
      ...options,
      input: schema,
    })
  }

  return result.stdout
}
