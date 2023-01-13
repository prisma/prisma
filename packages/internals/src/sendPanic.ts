import Debug from '@prisma/debug'
import { getPlatform } from '@prisma/get-platform'
import archiver from 'archiver'
import * as checkpoint from 'checkpoint-client'
import fs from 'fs'
import globby from 'globby'
import os from 'os'
import path from 'path'
import stripAnsi from 'strip-ansi'
import tmp from 'tmp'
import { match, P } from 'ts-pattern'

import { createErrorReport, ErrorKind, makeErrorReportCompleted, uploadZip } from './errorReporting'
import type { RustPanic } from './panic'
import { ErrorArea } from './panic'
import { mapScalarValues, maskSchema } from './utils/maskSchema'

const debug = Debug('prisma:sendPanic')
// cleanup the temporary files even when an uncaught exception occurs
tmp.setGracefulCleanup()

type SendPanic = {
  error: RustPanic
  cliVersion: string
  enginesVersion: string

  // retrieve the database version for the given schema or url, without throwing any error
  getDatabaseVersionSafe: (schemaOrUrl: string) => Promise<string | undefined>
}
export async function sendPanic({
  error,
  cliVersion,
  enginesVersion,
  getDatabaseVersionSafe,
}: SendPanic): Promise<number> {
  try {
    const schema: string | undefined = match(error)
      .with({ schemaPath: P.when((schemaPath) => Boolean(schemaPath)) }, (err) => {
        return fs.readFileSync(err.schemaPath, 'utf-8')
      })
      .with({ schema: P.when((schema) => Boolean(schema)) }, (err) => err.schema)
      .otherwise(() => undefined)

    const maskedSchema: string | undefined = schema ? maskSchema(schema) : undefined

    let dbVersion: string | undefined
    // For a SQLite datasource like `url = "file:dev.db"` only schema will be defined
    const schemaOrUrl = schema || error.introspectionUrl
    if (error.area === ErrorArea.LIFT_CLI && schemaOrUrl) {
      dbVersion = await getDatabaseVersionSafe(schemaOrUrl)
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
      binaryVersion: enginesVersion,
      command: getCommand(),
      jsStackTrace: stripAnsi(error.stack || error.message),
      rustStackTrace: error.rustStack,
      operatingSystem: `${os.arch()} ${os.platform()} ${os.release()}`,
      platform: await getPlatform(),
      liftRequest: migrateRequest,
      schemaFile: maskedSchema,
      fingerprint: await checkpoint.getSignature(),
      sqlDump: undefined,
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
    throw e
  }
}

function getCommand(): string {
  // don't send url
  if (process.argv[2] === 'introspect') {
    return 'introspect'
  } else if (process.argv[2] === 'db' && process.argv[3] === 'pull') {
    return 'db pull'
  }
  return process.argv.slice(2).join(' ')
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
  // Note: the following reads `error.schemaPath` for the second time, we could just re-use
  // `maskedSchema` from the `sendPanic` function's scope.
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
      if (filePath.endsWith('schema.prisma') || filePath.endsWith(path.basename(error.schemaPath))) {
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
