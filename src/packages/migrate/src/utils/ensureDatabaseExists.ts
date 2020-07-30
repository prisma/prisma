import { getSchema, getSchemaDir } from '@prisma/sdk'
import { getConfig } from '@prisma/sdk'
import chalk from 'chalk'
import { createDatabase } from '..'
import { canConnectToDatabase } from '../MigrateEngineCommands'
import { DatabaseCredentials, uriToCredentials } from '@prisma/sdk'
import prompt from 'prompts'

export type MigrateAction = 'create' | 'apply' | 'unapply' | 'dev' | 'push'

export async function ensureDatabaseExists(
  action: MigrateAction,
  forceCreate = false,
  schemaPath?: string,
) {
  const datamodel = await getSchema(schemaPath)
  const config = await getConfig({ datamodel })
  const activeDatasource = config.datasources[0]

  if (!activeDatasource) {
    throw new Error(`Couldn't find a datasource in the schema.prisma file`)
  }

  const schemaDir = (await getSchemaDir(schemaPath))!

  const canConnect = await canConnectToDatabase(
    activeDatasource.url.value,
    schemaDir,
  )
  if (canConnect === true) {
    return
  }
  const { code, message } = canConnect

  if (code !== 'P1003') {
    throw new Error(`${code}: ${message}`)
  }

  // last case: status === 'DatabaseDoesNotExist'

  if (!schemaDir) {
    throw new Error(`Could not locate ${schemaPath || 'schema.prisma'}`)
  }
  if (forceCreate) {
    await createDatabase(activeDatasource.url.value, schemaDir)
  } else {
    await interactivelyCreateDatabase(
      activeDatasource.url.value,
      action,
      schemaDir,
    )
  }
}

export async function interactivelyCreateDatabase(
  connectionString: string,
  action: MigrateAction,
  schemaDir: string,
): Promise<void> {
  await askToCreateDb(connectionString, action, schemaDir)
}

export async function askToCreateDb(
  connectionString: string,
  action: MigrateAction,
  schemaDir: string,
): Promise<void> {
  const credentials = uriToCredentials(connectionString)
  const dbName = credentials.database
  const dbType =
    credentials.type === 'mysql'
      ? 'MySQL'
      : credentials.type === 'postgresql'
      ? 'PostgreSQL'
      : credentials.type === 'sqlite'
      ? 'SQLite'
      : credentials.type

  const schemaWord = 'database'

  const message = `You are trying to ${action} a migration for ${dbType} ${schemaWord} ${chalk.bold(
    dbName,
  )}.\nA ${schemaWord} with that name doesn't exist at ${chalk.bold(
    getDbLocation(credentials),
  )}\n`

  // empty line
  console.log()
  const response = await prompt({
    type: 'select',
    name: 'value',
    message: message,
    initial: 0,
    choices: [
      {
        title: 'Yes',
        value: true,
        description: `Create new ${dbType} ${schemaWord} ${chalk.bold(dbName)}`,
      },
      {
        title: 'No',
        value: false,
        description: `Don't create the ${schemaWord}`,
      },
    ],
  })

  if (response.value) {
    await createDatabase(connectionString, schemaDir)
  } else {
    process.exit(0)
  }
}

function getDbLocation(credentials: DatabaseCredentials): string {
  if (credentials.type === 'sqlite') {
    return credentials.uri!
  }

  return `${credentials.host}:${credentials.port}`
}
