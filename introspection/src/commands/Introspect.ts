import { arg, Command, Env, format, isError } from '@prisma/cli'
import { isdlToDatamodel2, LiftEngine } from '@prisma/lift'
import { DataSource } from '@prisma/lift/dist/types'
import { Result } from 'arg'
import chalk from 'chalk'
import * as fs from 'fs'
import ora from 'ora'
import * as path from 'path'
import { DatabaseType } from 'prisma-datamodel'
import { credentialsToUri, databaseTypeToConnectorType } from '../convertCredentials'
import {
  assertSchemaExists,
  ConnectorData,
  getConnectedConnectorFromCredentials,
  getCredentialsFromExistingDatamodel,
  getDatabaseSchemas,
  populateMongoDatabase,
  prettyTime,
  sanitizeMongoUri,
  introspect,
} from '../introspect/util'
import { promptInteractively } from '../prompt'
import { DatabaseCredentials, IntrospectionResult } from '../types'

type Args = {
  '--env-file': StringConstructor
  '-e': '--env-file'
  '--project': StringConstructor
  '-p': '--project'

  /**
   * Postgres Params
   */
  '--pg-host': StringConstructor
  '--pg-port': StringConstructor
  '--pg-user': StringConstructor
  '--pg-password': StringConstructor
  '--pg-db': StringConstructor
  '--pg-ssl': BooleanConstructor
  '--pg-schema': StringConstructor

  /**
   * MySQL Params
   */
  '--mysql-host': StringConstructor
  '--mysql-port': StringConstructor
  '--mysql-user': StringConstructor
  '--mysql-password': StringConstructor
  '--mysql-db': StringConstructor

  /**
   * Mongo Params
   */
  '--mongo-uri': StringConstructor
  '--mongo-db': StringConstructor
  '--sdl': BooleanConstructor
  '--help': BooleanConstructor
}

type NewType = LiftEngine

export class Introspect implements Command {
  lift: NewType
  static new(env: Env): Introspect {
    return new Introspect(env)
  }

  private constructor(private readonly env: Env) {
    this.lift = new LiftEngine({
      projectDir: env.cwd,
    })
  }

  async parse(argv: string[]): Promise<any> {
    // parse the arguments according to the spec
    const args = arg(argv, {
      '--env-file': String,
      '-e': '--env-file',
      '--project': String,
      '-p': '--project',
      '--help': Boolean,
      '-h': '--help',

      /**
       * Postgres Params
       */
      '--pg-host': String,
      '--pg-port': String,
      '--pg-user': String,
      '--pg-password': String,
      '--pg-db': String,
      '--pg-ssl': Boolean,
      '--pg-schema': String,

      /**
       * MySQL Params
       */
      '--mysql-host': String,
      '--mysql-port': String,
      '--mysql-user': String,
      '--mysql-password': String,
      '--mysql-db': String,

      /**
       * Mongo Params
       */
      '--mongo-uri': String,
      '--mongo-db': String,
      '--sdl': Boolean,
    })

    if (isError(args)) {
      return null
    }

    if (args['--help']) {
      return this.help()
    }

    try {
      const sdl = args['--sdl']
      /**
       * Introspect
       */
      const { sdl: newDatamodelSdl, numTables, referenceDatamodelExists } = await this.introspectDatabase(args, sdl)

      if (!sdl) {
        /**
         * Write the result to the filesystem
         */

        const fileName = this.writeDatamodel(newDatamodelSdl)

        console.log(`\nCreated datamodel definition based on ${numTables} database tables`)
        const andDatamodelText = referenceDatamodelExists ? ' and the existing datamodel' : ''
        console.log(`\
${chalk.bold('Created 1 new file:')} Prisma DML datamodel (derived from existing database${andDatamodelText})

  ${chalk.cyan(fileName)}
`)
      } else {
        console.log(newDatamodelSdl)
      }
    } catch (e) {
      console.log(chalk.red(`\n${chalk.bold(`Error: ${e.message}`)}`))
    }

    // TODO: process.exit is needed because some listeners are probably not cleared properly
    process.exit(0)
  }

  getExistingDatamodel(): string | undefined {
    const datamodelPath = path.join(this.env.cwd, 'project.prisma')
    if (!fs.existsSync(datamodelPath)) {
      return undefined
    }
    return fs.readFileSync(datamodelPath, 'utf-8')
  }

  writeDatamodel(renderedSdl: string): string {
    const fileName = `datamodel-${Math.round(new Date().getTime() / 1000)}.prisma`
    const fullFileName = path.join(this.env.cwd, fileName)
    fs.writeFileSync(fullFileName, renderedSdl)
    return fileName
  }

  async introspectDatabase(args: Result<Args>, sdl: boolean | undefined): Promise<IntrospectionResult> {
    const credentialsByFlag =
      this.getCredentialsByFlags(args) || (await getCredentialsFromExistingDatamodel(this.env, this.lift))

    // Get everything interactively
    if (!credentialsByFlag) {
      const introspectionResult = await promptInteractively(introspect, 'introspect')

      return introspectionResult
    }

    // Get connector from flags
    if (!credentialsByFlag.schema) {
      console.log(`Please provide a database name`)
      return process.exit(1)
    }

    const { connector, disconnect } = await getConnectedConnectorFromCredentials(credentialsByFlag)

    const schemas = await getDatabaseSchemas(connector)

    assertSchemaExists(credentialsByFlag.schema, credentialsByFlag.type, schemas)

    const introspectionResult = await this.introspectWithSpinner(
      {
        connector,
        disconnect,
        databaseType: credentialsByFlag.type,
        databaseName: credentialsByFlag.schema,
        credentials: credentialsByFlag,
      },
      sdl,
    )
    await disconnect()

    return introspectionResult
  }

  getCredentialsByFlags(args: Result<Args>): DatabaseCredentials | null {
    const requiredPostgresFlags: (keyof Args)[] = ['--pg-host', '--pg-user', '--pg-password', '--pg-db']
    const requiredMysqlFlags: (keyof Args)[] = ['--mysql-host', '--mysql-user', '--mysql-password']

    const flagsKeys = Object.keys(args) as (keyof Args)[]

    const mysqlFlags = flagsKeys.filter(f => requiredMysqlFlags.includes(f))
    const postgresFlags = flagsKeys.filter(f => requiredPostgresFlags.includes(f))

    if (mysqlFlags.length > 0 && postgresFlags.length > 0) {
      throw new Error(`You can't provide both MySQL and Postgres connection flags. Please provide either of both.`)
    }

    if (mysqlFlags.length > 0 && mysqlFlags.length < requiredMysqlFlags.length) {
      this.handleMissingArgs(requiredMysqlFlags, mysqlFlags, 'mysql')
    }

    if (postgresFlags.length > 0 && postgresFlags.length < requiredPostgresFlags.length) {
      this.handleMissingArgs(requiredPostgresFlags, postgresFlags, 'pg')
    }

    if (mysqlFlags.length >= requiredMysqlFlags.length) {
      return {
        host: args['--mysql-host'],
        port: parseInt(args['--mysql-port']!, 10),
        user: args['--mysql-user'],
        password: args['--mysql-password'],
        schema: args['--mysql-db'],
        type: DatabaseType.mysql,
      }
    }

    if (postgresFlags.length >= requiredPostgresFlags.length) {
      return {
        host: args['--pg-host'],
        user: args['--pg-user'],
        password: args['--pg-password'],
        database: args['--pg-db'],
        port: parseInt(args['--pg-port']!, 10),
        schema: args['--pg-schema'],
        type: DatabaseType.postgres,
      } // this is optional and can be undefined
    }

    if (args['--mongo-uri']) {
      const uri = args['--mongo-uri']
      const database = args['--mongo-db'] // this is optional and can be undefined
      const credentials = populateMongoDatabase({
        uri,
        database,
      })
      return {
        uri: sanitizeMongoUri(credentials.uri),
        schema: credentials.database,
        type: DatabaseType.mongo,
      }
    }

    return null
  }

  handleMissingArgs(requiredArgs: string[], providedArgs: string[], prefix: string) {
    const missingArgs = requiredArgs.filter(arg => !providedArgs.some(provided => arg === provided))

    throw new Error(
      `If you provide one of the ${prefix}- arguments, you need to provide all of them. The arguments ${missingArgs.join(
        ', ',
      )} are missing.`,
    )
  }

  /**
   * Introspect the database
   */
  async introspectWithSpinner(connectorData: ConnectorData, sdl: boolean | undefined) {
    const spinner = ora({ color: 'cyan' })

    const before = Date.now()

    if (!sdl) {
      spinner.start(`Introspecting database ${chalk.bold(connectorData.databaseName)}`)
    }

    const introspectionResult = await introspect(connectorData)

    if (!sdl) {
      spinner.succeed(
        `Introspecting database ${chalk.bold(connectorData.databaseName)}: ${prettyTime(Date.now() - before)}`,
      )
    }

    return introspectionResult
  }

  help() {
    return console.log(
      format(`
Usage: prisma2 introspect [flags]

Introspect database schema(s) of service

Flags:
         -e, --env-file ENV-FILE    Path to .env file to inject env vars
           -p, --project PROJECT    Path to Prisma definition file
             --mongo-db MONGO-DB    Mongo database
           --mongo-uri MONGO-URI    Mongo connection string
             --mysql-db MYSQL-DB    The MySQL database
         --mysql-host MYSQL-HOST    Name of the MySQL host
 --mysql-password MYSQL-PASSWORD    The MySQL password
         --mysql-port MYSQL-PORT    The MySQL port. Default: 3306
         --mysql-user MYSQL-USER    The MySQL user
                   --pg-db PG-DB    The Postgres database
               --pg-host PG-HOST    Name of the Postgres host
       --pg-password PG-PASSWORD    The Postgres password
               --pg-port PG-PORT    The Postgres port. Default: 5432
           --pg-schema PG-SCHEMA    Name of the Postgres schema
                        --pg-ssl    Enable ssl for postgres
               --pg-user PG-USER    The Postgres user
                           --sdl    Omit any CLI output and just print the resulting datamodel. Requires an existing Prisma project with executeRaw. Useful for scripting
    `),
    )
  }
}

// async function run() {
//   await Introspect.new().parse(process.argv.slice(2))
// }

// run()
