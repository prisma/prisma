import { getPlatform } from '@prisma/get-platform'
import archiver from 'archiver'
import Debug from '@prisma/debug'
import fs from 'fs'
import globby from 'globby'
import fetch from 'node-fetch'
import os from 'os'
import path from 'path'
import stripAnsi from 'strip-ansi'
import tmp from 'tmp'
import * as checkpoint from 'checkpoint-client'
import { maskSchema, mapScalarValues } from './utils/maskSchema'
import { RustPanic, ErrorArea } from './panic'
import { getProxyAgent } from '@prisma/fetch-engine'
import { IntrospectionEngine } from './IntrospectionEngine'

const debug = Debug('sendPanic')
// cleanup the temporary files even when an uncaught exception occurs
tmp.setGracefulCleanup()

export async function sendPanic(
  error: RustPanic,
  cliVersion: string,
  binaryVersion: string,
): Promise<number | void> {
  try {
    let schema: undefined | string
    let maskedSchema: undefined | string
    if (error.schemaPath) {
      schema = fs.readFileSync(error.schemaPath, 'utf-8')
    }
    if (error.schema) {
      schema = error.schema
    }

    if (schema) {
      maskedSchema = maskSchema(schema)
    }

    let sqlDump: string | undefined
    let dbVersion: string | undefined
    // For a SQLite datasource like `url = "file:dev.db"` only error.schema will be defined
    const schemaOrUrl = error.schema || error.introspectionUrl
    if (error.area === ErrorArea.INTROSPECTION_CLI && schemaOrUrl) {
      let engine: undefined | IntrospectionEngine
      try {
        engine = new IntrospectionEngine()
        sqlDump = await engine.getDatabaseDescription(schemaOrUrl)
        dbVersion = await engine.getDatabaseVersion(schemaOrUrl)
        engine.stop()
      } catch (e) {
        debug(e)
        if (engine && engine.isRunning) {
          engine.stop()
        }
      }
    }

    const migrateRequest = error.request
      ? JSON.stringify(
          mapScalarValues(error.request, (value) => {
            if (typeof value === 'string') {
              return maskSchema(value)
            }
            return value
          }),
        )
      : undefined

    const params = {
      area: error.area,
      kind: ErrorKind.RUST_PANIC,
      cliVersion,
      binaryVersion,
      command: getCommand(),
      jsStackTrace: stripAnsi(error.stack || error.message),
      rustStackTrace: error.rustStack,
      operatingSystem: `${os.arch()} ${os.platform()} ${os.release()}`,
      platform: await getPlatform(),
      liftRequest: migrateRequest,
      schemaFile: maskedSchema,
      fingerprint: await checkpoint.getSignature(),
      sqlDump: sqlDump,
      dbVersion: dbVersion,
    }

    const signedUrl = await createErrorReport(params)

    if (error.schemaPath) {
      const zip = await makeErrorZip(error)
      await uploadZip(zip, signedUrl)
    }

    const id = await makeErrorReportCompleted(signedUrl)
    return id
  } catch (e) {
    debug(e)
  }
}

function getCommand(): string {
  if (process.argv[2] === 'introspect') {
    // don't send url
    return 'introspect'
  }
  return process.argv.slice(2).join(' ')
}

async function uploadZip(zip: Buffer, url: string): Promise<any> {
  return await fetch(url, {
    method: 'PUT',
    agent: getProxyAgent(url) as any,
    headers: {
      'Content-Length': String(zip.byteLength),
    },
    body: zip,
  })
}

async function makeErrorZip(error: RustPanic): Promise<Buffer> {
  if (!error.schemaPath) {
    throw new Error(`Can't make zip without schema path`)
  }
  const schemaDir = path.dirname(error.schemaPath)
  const tmpFileObj = tmp.fileSync()
  const outputFile = fs.createWriteStream(tmpFileObj.name)
  const zip = archiver('zip', { zlib: { level: 9 } })

  zip.pipe(outputFile)

  // add schema file
  const schemaFile = maskSchema(fs.readFileSync(error.schemaPath, 'utf-8'))
  zip.append(schemaFile, { name: path.basename(error.schemaPath) })

  if (fs.existsSync(schemaDir)) {
    const filePaths = await globby('migrations/**/*', {
      // globby doesn't have it in its types but it's part of mrmlnc/fast-glob
      // @ts-ignore
      cwd: schemaDir,
    })

    for (const filePath of filePaths) {
      let file = fs.readFileSync(path.resolve(schemaDir, filePath), 'utf-8')
      if (
        filePath.endsWith('schema.prisma') ||
        filePath.endsWith(path.basename(error.schemaPath))
      ) {
        // Remove credentials from schema datasource url
        file = maskSchema(file)
      }
      zip.append(file, { name: path.basename(filePath) })
    }
  }

  zip.finalize()

  return new Promise((resolve, reject) => {
    outputFile.on('close', () => {
      const buffer = fs.readFileSync(tmpFileObj.name)
      resolve(buffer)
    })

    zip.on('error', (err) => {
      reject(err)
    })
  })
}

export interface CreateErrorReportInput {
  area: ErrorArea
  binaryVersion: string
  cliVersion: string
  command: string
  jsStackTrace: string
  kind: ErrorKind
  liftRequest?: string
  operatingSystem: string
  platform: string
  rustStackTrace: string
  schemaFile?: string
  fingerprint?: string
  sqlDump?: string
  dbVersion?: string
}

export enum ErrorKind {
  JS_ERROR = 'JS_ERROR',
  RUST_PANIC = 'RUST_PANIC',
}

export async function createErrorReport(
  data: CreateErrorReportInput,
): Promise<string> {
  const result = await request(
    `mutation ($data: CreateErrorReportInput!) {
    createErrorReport(data: $data)
  }`,
    { data },
  )
  return result.createErrorReport
}

export async function makeErrorReportCompleted(
  signedUrl: string,
): Promise<number> {
  const result = await request(
    `mutation ($signedUrl: String!) {
  markErrorReportCompleted(signedUrl: $signedUrl)
}`,
    { signedUrl },
  )
  return result.markErrorReportCompleted
}

async function request(query: string, variables: any): Promise<any> {
  const url = 'https://error-reports.prisma.sh/'
  const body = JSON.stringify({
    query,
    variables,
  })
  return await fetch(url, {
    method: 'POST',
    agent: getProxyAgent(url) as any,
    body,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })
    .then((res) => res.json())
    .then((res) => {
      if (res.errors) {
        throw new Error(JSON.stringify(res.errors))
      }
      return res.data
    })
}
