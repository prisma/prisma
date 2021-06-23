import { BinaryType } from '@prisma/fetch-engine'
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

// ### Exit codes
// `0`: normal exit
// `1`: abnormal (error) exit
// `101`: panic
// Non-zero exit codes should always be accompanied by a log message on stderr with the `ERROR` level.
export enum MigrateEngineExitCode {
  Success = 0,
  Error = 1,
  Panic = 101,
}

// Logging and crash reporting happens through JSON logs on the Migration Engine's
// stderr. Every line contains a single JSON object conforming to the following
// interface:
// {"timestamp":"2021-06-11T15:35:34.084486+00:00","level":"ERROR","fields":{"is_panic":false,"error_code":"","message":"Failed to delete SQLite database at `dev.db`.\nNo such file or directory (os error 2)\n"},"target":"migration_engine::logger"}
// {"timestamp":"2021-06-11T15:35:34.320358+00:00","level":"INFO","fields":{"message":"Starting migration engine CLI","git_hash":"a92947d63ede9b0b5b5aab253c2a7d9ad6cabe15"},"target":"migration_engine"}
export interface MigrateEngineLogLine {
  timestamp: string
  level: LogLevel
  fields: LogFields
  target: string
}
type LogLevel = 'INFO' | 'ERROR' | 'DEBUG' | 'WARN'
interface LogFields {
  message: string
  git_hash?: string
  // Only for ERROR level messages
  is_panic?: boolean
  error_code?: string
  [key: string]: any
}

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
}

function parseJsonFromStderr(stderr: string): MigrateEngineLogLine[] {
  // split by new line
  const lines = stderr.split(/\r?\n/).slice(1) // Remove first element
  const logs: any = []

  for (const line of lines) {
    const data = String(line)
    try {
      const json: MigrateEngineLogLine = JSON.parse(data)
      logs.push(json)
    } catch (e) {
      throw new Error(`Could not parse migration engine response: ${e}`)
    }
  }

  return logs
}

export async function canConnectToDatabase(
  connectionString: string,
  cwd = process.cwd(),
  migrationEnginePath?: string,
): Promise<ConnectionResult> {
  if (!connectionString) {
    throw new Error(
      'Connection url is empty. See https://www.prisma.io/docs/reference/database-reference/connection-urls',
    )
  }

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
    if (e.stderr) {
      const logs = parseJsonFromStderr(e.stderr)
      const error = logs.find((it) => it.level === 'ERROR')

      if (error && error.fields.error_code && error.fields.message) {
        return {
          code: error.fields.error_code as DatabaseErrorCodes,
          message: error.fields.message,
        }
      } else {
        throw new Error(
          `Migration engine error:\n${logs
            .map((log) => log.fields.message)
            .join('\n')}`,
        )
      }
    } else {
      throw new Error(`Migration engine exited.`)
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

  // If database is already created, stop here, don't create it
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
    if (e.stderr) {
      const logs = parseJsonFromStderr(e.stderr)
      const error = logs.find((it) => it.level === 'ERROR')

      if (error && error.fields.error_code && error.fields.message) {
        throw new Error(`${error.fields.error_code}: ${error.fields.message}`)
      } else {
        throw new Error(
          `Migration engine error:\n${logs
            .map((log) => log.fields.message)
            .join('\n')}`,
        )
      }
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
    if (e.stderr) {
      const logs = parseJsonFromStderr(e.stderr)

      throw new Error(
        `Migration engine error:\n${logs
          .map((log) => log.fields.message)
          .join('\n')}`,
      )
    } else {
      throw new Error(`Migration engine exited.`)
    }
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
    migrationEnginePath || (await resolveBinary(BinaryType.migrationEngine))

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

export async function doesSqliteDbExist(
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
