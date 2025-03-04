import { getBinaryTargetForCurrentPlatform } from '@prisma/get-platform'
import archiver from 'archiver'
import * as checkpoint from 'checkpoint-client'
import fs from 'node:fs'
import globby from 'globby'
import os from 'node:os'
import path from 'node:path'
import stripAnsi from 'strip-ansi'
import tmp from 'tmp'
import { match, P } from 'ts-pattern'

import { getSchema } from './cli/getSchema'
import {
  createErrorReport,
  type CreateErrorReportInput,
  ErrorKind,
  makeErrorReportCompleted,
  uploadZip,
} from './errorReporting'
import type { MigrateTypes } from './migrateTypes'
import type { RustPanic } from './panic'
import { ErrorArea } from './panic'
import { mapScalarValues, maskSchema, maskSchemas } from './utils/maskSchema'
import type { MultipleSchemas } from './utils/schemaFileInput'
import { toSchemasContainer } from './utils/toSchemasContainer'

// cleanup the temporary files even when an uncaught exception occurs
tmp.setGracefulCleanup()

type SendPanic = {
  error: RustPanic
  cliVersion: string
  enginesVersion: string

  // retrieve the database version for the given schema or url, without throwing any error
  getDatabaseVersionSafe: (args: MigrateTypes.GetDatabaseVersionParams | undefined) => Promise<string | undefined>
}
export async function sendPanic({
  error,
  cliVersion,
  enginesVersion,
  getDatabaseVersionSafe,
}: SendPanic): Promise<number> {
  const schema: MultipleSchemas | undefined = await match(error)
    .with({ schemaPath: P.not(P.nullish) }, (err) => {
      return getSchema(err.schemaPath)
    })
    .with({ schema: P.not(P.nullish) }, (err) => Promise.resolve(err.schema))
    .otherwise(() => undefined)

  const maskedSchema: MultipleSchemas | undefined = schema ? maskSchemas(schema) : undefined

  let dbVersion: string | undefined
  if (error.area === ErrorArea.LIFT_CLI) {
    // For a SQLite datasource like `url = "file:dev.db"` only schema will be defined
    const getDatabaseVersionParams: MigrateTypes.GetDatabaseVersionParams | undefined = match({
      schema,
      introspectionUrl: error.introspectionUrl,
    })
      .with({ schema: P.not(undefined) }, ({ schema }) => {
        return {
          datasource: {
            tag: 'Schema',
            ...toSchemasContainer(schema),
          },
        } as const
      })
      .with({ introspectionUrl: P.not(undefined) }, ({ introspectionUrl }) => {
        return {
          datasource: {
            tag: 'ConnectionString',
            url: introspectionUrl,
          },
        } as const
      })
      .otherwise(() => undefined)

    dbVersion = await getDatabaseVersionSafe(getDatabaseVersionParams)
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

  const params: CreateErrorReportInput = {
    area: error.area,
    kind: ErrorKind.RUST_PANIC,
    cliVersion,
    binaryVersion: enginesVersion,
    command: getCommand(),
    jsStackTrace: stripAnsi(error.stack || error.message),
    rustStackTrace: error.rustStack,
    operatingSystem: `${os.arch()} ${os.platform()} ${os.release()}`,
    platform: await getBinaryTargetForCurrentPlatform(),
    liftRequest: migrateRequest,
    schemaFile: concatSchemaForReport(maskedSchema),
    fingerprint: await checkpoint.getSignature(),
    sqlDump: undefined,
    dbVersion: dbVersion,
  }

  // Get an AWS S3 signed URL from the server, so we can upload a zip file
  const signedUrl = await createErrorReport(params)

  // Create & upload the zip file
  // only log if something fails
  try {
    if (error.schemaPath) {
      const zip = await makeErrorZip(error)
      await uploadZip(zip, signedUrl)
    }
  } catch (zipUploadError) {
    console.error(`Error uploading zip file: ${zipUploadError.message}`)
  }

  // Mark the error report as completed
  const id = await makeErrorReportCompleted(signedUrl)

  return id
}

function concatSchemaForReport(schemaFiles: MultipleSchemas | undefined) {
  if (!schemaFiles) {
    return undefined
  }
  return schemaFiles.map(([path, content]) => `// ${path}\n${content}`).join('\n')
}

function getCommand(): string {
  // don't send url
  if (process.argv[2] === 'introspect') {
    return 'introspect'
  }if (process.argv[2] === 'db' && process.argv[3] === 'pull') {
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
