import { getCwd } from '@prisma/cli'
import { getPlatform } from '@prisma/get-platform'
import execa from 'execa'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { uriToCredentials } from './utils/uriToCredentials'

const exists = promisify(fs.exists)

async function getMigrationEnginePath(): Promise<string> {
  // tslint:disable-next-line
  const dir = eval('__dirname')
  const platform = await getPlatform()
  const extension = platform === 'windows' ? '.exe' : ''
  const relative = `../migration-engine${extension}`
  return path.join(dir, relative)
}

export type ConnectionStatus =
  | 'DatabaseDoesNotExist'
  | 'DatabaseAccessDenied'
  | 'AuthenticationFailed'
  | 'Ok'
  | 'UndefinedError'

export interface ConnectionResult {
  status: ConnectionStatus
  message: string
}

export async function canConnectToDatabase(
  connectionString: string,
  cwd = process.cwd(),
  migrationEnginePath?: string,
): Promise<ConnectionResult> {
  const credentials = uriToCredentials(connectionString)

  if (credentials.type === 'sqlite') {
    const sqliteExists = await doesSqliteDbExist(connectionString)
    if (sqliteExists) {
      return {
        message: 'Exists',
        status: 'Ok',
      }
    } else {
      return {
        message: "Sqlite DB file doesn't exist",
        status: 'DatabaseDoesNotExist',
      }
    }
  }

  migrationEnginePath = migrationEnginePath || (await getMigrationEnginePath())
  try {
    const result = await execa(
      migrationEnginePath,
      ['cli', '--datasource', connectionString, '--can_connect_to_database'],
      {
        cwd,
        env: {
          ...process.env,
          RUST_BACKTRACE: '1',
          RUST_LOG: 'info',
        },
      },
    )

    return {
      message: extractMessage(result.stderr),
      status: 'Ok',
    }
  } catch (e) {
    if (e.code === 1) {
      return {
        message: extractMessage(e.stderr),
        status: 'DatabaseDoesNotExist',
      }
    }
    if (e.code === 2) {
      return {
        message: extractMessage(e.stderr),
        status: 'DatabaseAccessDenied',
      }
    }
    if (e.code === 3) {
      return {
        message: extractMessage(e.stderr),
        status: 'AuthenticationFailed',
      }
    }
    if (e.stderr) {
      return {
        message: extractMessage(e.stderr),
        status: 'UndefinedError',
      }
    }
    throw e
  }
}

export async function createDatabase(
  connectionString: string,
  cwd = process.cwd(),
  migrationEnginePath?: string,
): Promise<void> {
  const dbExists = await canConnectToDatabase(connectionString, cwd, migrationEnginePath)
  if (dbExists.status === 'Ok') {
    return
  }
  migrationEnginePath = migrationEnginePath || (await getMigrationEnginePath())
  await execa(migrationEnginePath, ['cli', '--datasource', connectionString, '--create_database'], {
    cwd,
    env: {
      ...process.env,
      RUST_BACKTRACE: '1',
      RUST_LOG: 'info',
    },
  })
}

// extracts messages from strings like `[2019-09-17T08:03:11Z ERROR migration_engine] Database \'strapi2\' does not exist.\n`
function extractMessage(stderr: string) {
  const closedBracketsIndex = stderr.indexOf(']')
  return stderr.slice(closedBracketsIndex + 1).trim()
}

async function doesSqliteDbExist(connectionString: string): Promise<boolean> {
  let filePath = connectionString

  if (filePath.startsWith('file:')) {
    filePath = filePath.slice(5)
  }

  const cwd = await getCwd()

  const absoluteTarget = path.resolve(cwd, filePath)

  return exists(absoluteTarget)
}
