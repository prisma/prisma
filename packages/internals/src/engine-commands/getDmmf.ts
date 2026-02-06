import Debug from '@prisma/debug'
import type * as DMMF from '@prisma/dmmf'
import { getEnginesPath } from '@prisma/engines'
import type { DataSource, GeneratorConfig } from '@prisma/generator'
import { getBinaryTargetForCurrentPlatform } from '@prisma/get-platform'
import { spawn } from 'child_process'
import * as E from 'fp-ts/Either'
import { pipe } from 'fp-ts/lib/function'
import * as TE from 'fp-ts/TaskEither'
import fs from 'fs'
import { bold, red } from 'kleur/colors'
import path from 'path'
import { match } from 'ts-pattern'

import { ErrorArea, getWasmError, isWasmPanic, RustPanic, WasmPanic } from '../panic'
import { type SchemaFileInput } from '../utils/schemaFileInput'
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
  datamodel: SchemaFileInput
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
 * Check if an error is the V8 string length limit.
 * V8 has a hard-coded limit of 0x1fffffe8 characters (~536MB) for strings.
 * No Node.js flags can change this.
 * See: https://github.com/prisma/prisma/issues/29111
 */
function isV8StringLimitError(error: unknown): boolean {
  return error instanceof RangeError && error.message.includes('Cannot create a string longer than')
}

/**
 * Resolve the path to the prisma-fmt native binary.
 * Checks: (1) PRISMA_FMT_BINARY env var, (2) alongside engines in standard path.
 */
async function resolvePrismaFmtBinary(): Promise<string> {
  // Check explicit env var first
  const envPath = process.env.PRISMA_FMT_BINARY
  if (envPath && fs.existsSync(envPath)) {
    return envPath
  }

  // Check alongside schema engine in engines path
  const binaryTarget = await getBinaryTargetForCurrentPlatform()
  const extension = binaryTarget === 'windows' ? '.exe' : ''
  const binaryName = `prisma-fmt-${binaryTarget}${extension}`
  const enginesPath = path.join(getEnginesPath(), binaryName)
  if (fs.existsSync(enginesPath)) {
    return enginesPath
  }

  throw new Error(
    `prisma-fmt binary not found. Set PRISMA_FMT_BINARY env var or ensure it is installed alongside @prisma/engines.\n` +
      `Searched: ${enginesPath}`,
  )
}

/**
 * Spawn the prisma-fmt native binary to generate DMMF, streaming the output
 * through a JSON parser. This has no memory ceiling (unlike WASM) because
 * serde_json::to_writer() streams directly to stdout.
 * See: https://github.com/prisma/prisma/issues/29111
 */
async function getDmmfBinaryStreaming(params: string): Promise<DMMF.Document> {
  const binaryPath = await resolvePrismaFmtBinary()
  debug(`Using prisma-fmt binary at: ${binaryPath}`)

  const { JSONParser } = require('@streamparser/json') as typeof import('@streamparser/json')

  return new Promise<DMMF.Document>((resolve, reject) => {
    const child = spawn(binaryPath, ['get-dmmf'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        RUST_BACKTRACE: process.env.RUST_BACKTRACE ?? '1',
      },
    })

    const parser = new JSONParser()
    let result: DMMF.Document | undefined
    let stderr = ''

    parser.onValue = ({ value, stack }) => {
      if (stack.length === 0 && value !== undefined) {
        result = value as unknown as DMMF.Document
      }
    }

    child.stdout.on('data', (chunk: Buffer) => {
      parser.write(chunk)
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('close', (code: number) => {
      if (code !== 0) {
        reject(new Error(`prisma-fmt exited with code ${code}: ${stderr}`))
        return
      }
      if (result === undefined) {
        reject(new Error('prisma-fmt produced no DMMF output'))
        return
      }
      debug(`DMMF retrieved via binary streaming`)
      resolve(result)
    })

    child.on('error', (err: Error) => {
      reject(new Error(`Failed to spawn prisma-fmt: ${err.message}`))
    })

    // Write params to stdin and close
    child.stdin.write(params)
    child.stdin.end()
  })
}

/**
 * Wasm'd version of `getDMMF`.
 */
export async function getDMMF(options: GetDMMFOptions): Promise<DMMF.Document> {
  const debugErrorType = createDebugErrorType(debug, 'getDmmfWasm')
  debug(`Using getDmmf Wasm`)

  const dmmfPipeline = pipe(
    E.tryCatch(
      () => {
        if (process.env.FORCE_PANIC_GET_DMMF) {
          debug('Triggering a Rust panic...')
          prismaSchemaWasm.debug_panic()
        }

        const params = JSON.stringify({
          prismaSchema: options.datamodel,
          noColor: Boolean(process.env.NO_COLOR),
        })
        const data = prismaSchemaWasm.get_dmmf(params)
        return data
      },
      (e) =>
        ({
          type: 'wasm-error' as const,
          reason: '(get-dmmf wasm)',
          error: e as Error | WasmPanic,
        }) as const,
    ),
    E.map((result) => ({ result })),
    E.chainW(({ result }) =>
      // NOTE: this should never fail, as we expect returned values to be valid JSON-serializable strings
      E.tryCatch(
        () => JSON.parse(result) as DMMF.Document,
        (e) => ({
          type: 'parse-json' as const,
          reason: 'Unable to parse JSON',
          error: e as Error,
        }),
      ),
    ),
    TE.fromEither,
  )

  const dmmfEither = await dmmfPipeline()

  if (E.isRight(dmmfEither)) {
    debug('dmmf data retrieved without errors in getDmmf Wasm')
    const { right: data } = dmmfEither
    return Promise.resolve(data)
  }

  /**
   * If the error is a V8 string length limit, fall back to the binary streaming API.
   * This bypasses the limit by spawning the prisma-fmt native binary, which uses
   * serde_json::to_writer() to stream DMMF JSON to stdout with no memory ceiling.
   * See: https://github.com/prisma/prisma/issues/29111
   */
  const leftError = dmmfEither.left
  if (leftError.type === 'wasm-error' && isV8StringLimitError(leftError.error)) {
    debug('V8 string limit hit, falling back to binary streaming')

    try {
      const params = JSON.stringify({
        prismaSchema: options.datamodel,
        noColor: Boolean(process.env.NO_COLOR),
      })
      const data = await getDmmfBinaryStreaming(params)
      debug('dmmf data retrieved via binary streaming')
      return data
    } catch (binaryError) {
      debugErrorType({
        type: 'wasm-error' as const,
        reason: '(get-dmmf-binary)',
        error: binaryError as Error,
      })
      throw new GetDmmfError({
        _tag: 'unparsed',
        message: `Binary streaming fallback failed: ${(binaryError as Error).message}`,
        reason: '(get-dmmf-binary)',
      })
    }
  }

  /**
   * Check which error to throw.
   */
  const error = match(dmmfEither.left)
    .with({ type: 'wasm-error' }, (e) => {
      debugErrorType(e)

      /**
       * Capture and propagate possible Wasm panics.
       */
      if (isWasmPanic(e.error)) {
        const { message, stack } = getWasmError(e.error)

        const panic = new RustPanic(
          /* message */ message,
          /* rustStack */ stack,
          /* request */ '@prisma/prisma-schema-wasm get_dmmf',
          ErrorArea.FMT_CLI,
        )
        return panic
      }

      /*
       * Extract the actual error by attempting to JSON-parse the error message.
       */
      const errorOutput = e.error.message
      return new GetDmmfError(parseQueryEngineError({ errorOutput, reason: e.reason }))
    })
    .with({ type: 'parse-json' }, (e) => {
      debugErrorType(e)
      return new GetDmmfError({ _tag: 'unparsed', message: e.error.message, reason: e.reason })
    })
    .exhaustive()

  throw error
}
