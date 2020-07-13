import { getSchemaDir, resolveBinary } from '@prisma/sdk'
import { uriToCredentials } from '@prisma/sdk'
import execa from 'execa'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const exists = promisify(fs.exists)

// https://github.com/prisma/specs/tree/master/errors#common
export type DatabaseErrorCodes =
  | 'P1000'
  | 'P1001'
  | 'P1002'
  | 'P1003'
  | 'P1009'
  | 'P1010'

export type ConnectionResult = true | ConnectionError

export interface ConnectionError {
  message: string
  code: DatabaseErrorCodes
  meta?: any
}

interface CommandErrorJson {
  message: string
  meta?: any
  error_code: DatabaseErrorCodes
}

export async function canConnectToDatabase(
  connectionString: string,
  cwd = process.cwd(),
  migrationEnginePath?: string,
): Promise<ConnectionResult> {
  const credentials = uriToCredentials(connectionString)

  if (credentials.type === 'sqlite') {
    const sqliteExists = await doesSqliteDbExist(connectionString, cwd)
    if (sqliteExists) {
      return true
    } else {
      return {
        code: 'P1003',
        message: "SQLite database file doesn't exist",
      }
    }
  }

  migrationEnginePath =
    migrationEnginePath || (await resolveBinary('migration-engine'))
  try {
    await execa(
      migrationEnginePath,
      ['cli', '--datasource', connectionString, 'can-connect-to-database'],
      {
        cwd,
        env: {
          ...process.env,
          RUST_BACKTRACE: '1',
          RUST_LOG: 'info',
        },
      },
    )

    return true
  } catch (e) {
    let json: CommandErrorJson
    try {
      json = JSON.parse(e.stdout)
    } catch (e) {
      throw new Error(`Can't parse migration engine response:\n${e.stdout}`)
    }

    return {
      code: json.error_code,
      message: json.message,
      meta: json.meta,
    }
  }
}

export async function createDatabase(
  connectionString: string,
  cwd = process.cwd(),
  migrationEnginePath?: string,
): Promise<void> {
  const dbExists = await canConnectToDatabase(
    connectionString,
    cwd,
    migrationEnginePath,
  )
  if (dbExists === true) {
    return
  }
  migrationEnginePath =
    migrationEnginePath || (await resolveBinary('migration-engine'))
  await execa(
    migrationEnginePath,
    ['cli', '--datasource', connectionString, 'create-database'],
    {
      cwd,
      env: {
        ...process.env,
        RUST_BACKTRACE: '1',
        RUST_LOG: 'info',
      },
    },
  )
}

async function doesSqliteDbExist(
  connectionString: string,
  schemaDir?: string,
): Promise<boolean> {
  let filePath = connectionString

  if (filePath.startsWith('file:')) {
    filePath = filePath.slice(5)
  }

  const cwd = schemaDir || (await getSchemaDir())
  if (!cwd) {
    throw new Error(`Could not find schema.prisma in ${process.cwd()}`)
  }

  const absoluteTarget = path.resolve(cwd, filePath)

  return exists(absoluteTarget)
}
