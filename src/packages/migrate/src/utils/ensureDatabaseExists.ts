import { getSchema, getSchemaDir } from '@prisma/sdk'
import { getConfig } from '@prisma/sdk'
import chalk from 'chalk'
import {
  DatabaseCredentials,
  uriToCredentials,
  createDatabase,
  canConnectToDatabase,
} from '@prisma/sdk'
import prompt from 'prompts'
import execa from 'execa'

export type MigrateAction = 'create' | 'apply' | 'unapply' | 'dev' | 'push'
type dbType = 'MySQL' | 'PostgreSQL' | 'SQLite' | 'SQL Server'

export async function getDbInfo(schemaPath?: string): Promise<{
  name: string
  url: string
  schemaWord: 'database'
  dbLocation?: string
  dbType?: dbType
  dbName?: string
  schema?: string
}> {
  const datamodel = await getSchema(schemaPath)
  const config = await getConfig({ datamodel })
  const activeDatasource = config.datasources[0]

  try {
    const credentials = uriToCredentials(activeDatasource.url.value)
    const dbLocation = getDbLocation(credentials)
    const dbinfoFromCredentials = getDbinfoFromCredentials(credentials)

    return {
      name: activeDatasource.name,
      dbLocation,
      ...dbinfoFromCredentials,
      url: activeDatasource.url.value,
      schema: credentials.schema,
    }
  } catch (e) {
    return {
      name: activeDatasource.name,
      schemaWord: 'database',
      dbType: undefined,
      dbName: undefined,
      dbLocation: undefined,
      url: activeDatasource.url.value,
    }
  }
}

export async function ensureCanConnectToDatabase(
  schemaPath?: string,
): Promise<Boolean | Error> {
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
    return true
  } else {
    const { code, message } = canConnect
    throw new Error(`${code}: ${message}`)
  }
}

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
    if (await createDatabase(activeDatasource.url.value, schemaDir)) {
      const credentials = uriToCredentials(activeDatasource.url.value)
      const { schemaWord, dbType, dbName } =
        getDbinfoFromCredentials(credentials)
      if (dbType) {
        return `${dbType} ${schemaWord} ${chalk.bold(
          dbName,
        )} created at ${chalk.bold(getDbLocation(credentials))}\n`
      } else {
        return `${schemaWord} created.\n`
      }
    }
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
): Promise<execa.ExecaReturnValue | undefined | void> {
  const credentials = uriToCredentials(connectionString)
  const { schemaWord, dbType, dbName } = getDbinfoFromCredentials(credentials)
  const message = `You are trying to ${action} a migration for ${dbType} ${schemaWord} ${chalk.bold(
    dbName,
  )}.\nA ${schemaWord} with that name doesn't exist at ${chalk.bold(
    getDbLocation(credentials),
  )}\n`

  // empty line
  console.info()
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

export function getDbLocation(credentials: DatabaseCredentials): string {
  if (credentials.type === 'sqlite') {
    return credentials.uri!
  }

  if (!credentials.port) {
    switch (credentials.type) {
      case 'mysql':
        credentials.port = 3306
        break
      case 'postgresql':
        credentials.port = 5432
        break
      case 'sqlserver':
        credentials.port = 1433
        break
    }
  }

  return `${credentials.host}:${credentials.port}`
}

export function getDbinfoFromCredentials(credentials): {
  dbName: string
  dbType: dbType
  schemaWord: 'database'
} {
  const dbName = credentials.database

  let dbType
  switch (credentials.type) {
    case 'mysql':
      dbType = `MySQL`
      break
    case 'postgresql':
      dbType = `PostgreSQL`
      break
    case 'sqlite':
      dbType = `SQLite`
      break
    case 'sqlserver':
    case 'mssql':
      dbType = `SQL Server`
      break
  }

  const schemaWord = 'database'

  return {
    dbName,
    dbType,
    schemaWord,
  }
}
