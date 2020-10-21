import execa from 'execa'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { uriToCredentials } from './convertCredentials'
import { resolveBinary } from './resolveBinary'
import { getSchemaDir } from './cli/getSchema'

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
    if (e.stdout) {
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
    } else if (e.stderr) {
      throw new Error(`Migration engine error:\n${e.stderr}`)
    } else {
      throw new Error(`Migration engine exited.`)
    }
  }
}

export async function createDatabase(
  connectionString: string,
  cwd = process.cwd(),
  migrationEnginePath?: string,
): Promise<execa.ExecaReturnValue | boolean> {
  const dbExists = await canConnectToDatabase(
    connectionString,
    cwd,
    migrationEnginePath,
  )

  if (dbExists === true) {
    return false
  }

  migrationEnginePath =
    migrationEnginePath || (await resolveBinary('migration-engine'))

  return await execa(
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

export async function dropDatabase(
  connectionString: string,
  cwd = process.cwd(),
  migrationEnginePath?: string,
): Promise<execa.ExecaReturnValue> {
  migrationEnginePath =
    migrationEnginePath || (await resolveBinary('migration-engine'))
  return await execa(
    migrationEnginePath,
    ['cli', '--datasource', connectionString, 'drop-database'],
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
  } else if (filePath.startsWith('sqlite:')) {
    filePath = filePath.slice(7)
  }

  const cwd = schemaDir || (await getSchemaDir())
  if (!cwd) {
    throw new Error(`Could not find schema.prisma in ${process.cwd()}`)
  }

  const absoluteTarget = path.resolve(cwd, filePath)

  return exists(absoluteTarget)
}
