import { EngineTypes } from '@prisma/fetch-engine'
import execa from 'execa'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { getSchemaDir } from './cli/getSchema'
import {
  databaseTypeToConnectorType,
  protocolToDatabaseType,
} from './convertCredentials'
import { resolveBinary } from './resolveBinary'

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
  const provider = databaseTypeToConnectorType(
    protocolToDatabaseType(`${connectionString.split(':')[0]}:`),
  )

  if (provider === 'sqlite') {
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

  try {
    await execaCommand({
      connectionString,
      cwd,
      migrationEnginePath,
      engineCommandName: 'can-connect-to-database',
    })
  } catch (e) {
    if (e.stdout) {
      let json: CommandErrorJson
      try {
        json = JSON.parse(e.stdout.trim())
      } catch (e) {
        throw new Error(`Can't parse migration engine response:\n${e.stdout}`)
      }

      return {
        code: json.error_code,
        message: json.message,
        meta: json.meta,
      }
    }

    if (e.stderr) {
      throw new Error(`Migration engine error:\n${e.stderr}`)
    } else {
      throw new Error("Can't create database")
    }
  }

  return true
}

export async function createDatabase(
  connectionString: string,
  cwd = process.cwd(),
  migrationEnginePath?: string,
) {
  const dbExists = await canConnectToDatabase(
    connectionString,
    cwd,
    migrationEnginePath,
  )

  if (dbExists === true) {
    return false
  }

  try {
    await execaCommand({
      connectionString,
      cwd,
      migrationEnginePath,
      engineCommandName: 'create-database',
    })

    return true
  } catch (e) {
    if (e.stdout) {
      let error

      try {
        error = JSON.parse(e.stdout.trim())
      } catch (e) {}

      if (error?.message) {
        throw new Error(error.message)
      }
    }

    if (e.stderr) {
      throw new Error(`Migration engine error:\n${e.stderr}`)
    } else {
      throw new Error(`Migration engine exited.`)
    }
  }
}

export async function dropDatabase(
  connectionString: string,
  cwd = process.cwd(),
  migrationEnginePath?: string,
) {
  try {
    const result = await execaCommand({
      connectionString,
      cwd,
      migrationEnginePath,
      engineCommandName: 'drop-database',
    })

    if (
      result &&
      result.exitCode === 0 &&
      result.stderr.includes('The database was successfully dropped')
    ) {
      return true
    } else {
      // We should not arrive here normally
      throw Error(
        `An error occurred during the drop: ${JSON.stringify(
          result,
          undefined,
          2,
        )}`,
      )
    }
  } catch (e) {
    let json
    try {
      json = JSON.parse(e.stdout)
    } catch (e) {
      console.error(
        `Could not parse database drop engine response: ${e.stdout.slice(
          0,
          200,
        )}`,
      )
    }

    if (json.message) {
      throw Error(json.message)
    }

    throw Error(e)
  }
}

export async function execaCommand({
  connectionString,
  cwd,
  migrationEnginePath,
  engineCommandName,
}: {
  connectionString: string
  cwd: string
  migrationEnginePath?: string
  engineCommandName:
    | 'create-database'
    | 'drop-database'
    | 'can-connect-to-database'
}) {
  migrationEnginePath =
    migrationEnginePath || (await resolveBinary(EngineTypes.migrationEngine))

  try {
    return await execa(
      migrationEnginePath,
      ['cli', '--datasource', connectionString, engineCommandName],
      {
        cwd,
        env: {
          RUST_BACKTRACE: '1',
          RUST_LOG: 'info',
        },
      },
    )
  } catch (e) {
    if (e.message) {
      e.message = e.message.replace(connectionString, '<REDACTED>')
    }
    if (e.stdout) {
      e.stdout = e.stdout.replace(connectionString, '<REDACTED>')
    }
    if (e.stderr) {
      e.stderr = e.stderr.replace(connectionString, '<REDACTED>')
    }
    throw e
  }
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
