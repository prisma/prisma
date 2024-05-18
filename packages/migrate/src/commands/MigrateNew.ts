import Debug from '@prisma/debug'
import {
  arg,
  checkUnsupportedDataProxy,
  Command,
  format,
  getCommandWithExecutor,
  getConfig,
  HelpError,
  isError,
  loadEnvFile,
  validate,
} from '@prisma/internals'
import { bold, dim, green, red } from 'kleur/colors'

import { Migrate } from '../Migrate'
import { ensureDatabaseExists, getDatasourceInfo } from '../utils/ensureDatabaseExists'
import { getSchemaPathAndPrint } from '../utils/getSchemaPathAndPrint'
import { printDatasource } from '../utils/printDatasource'
import { printMigrationId } from '../utils/printMigrationId'
import { getMigrationName } from '../utils/promptForMigrationName'

const debug = Debug('prisma:migrate:new')

export class MigrateNew implements Command {
  public static new(): MigrateNew {
    return new MigrateNew()
  }

  private static help = format(`
  ${process.platform === 'win32' ? '' : '🏋️  '}Create a new migration with a blank sql file

  ${bold('Usage')}

    ${dim('$')} prisma migrate new [options]

  ${bold('Options')}
  
         -h, --help   Display this help message
           --schema   Custom path to your Prisma schema
         -n, --name   Name the migration

  ${bold('Examples')}

    Create a new migration with a blank sql file
    ${dim('$')} prisma migrate new --name=CreateUserTable

    Specify a schema
    ${dim('$')} prisma migrate new --schema=./schema.prisma
  `)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--name': String,
      '-n': '--name',
      '--schema': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    await checkUnsupportedDataProxy('migrate new', args, true)

    if (args['--help']) {
      return this.help()
    }

    loadEnvFile({ schemaPath: args['--schema'], printMessage: true })

    const { schemaPath, schemas } = (await getSchemaPathAndPrint(args['--schema']))!

    const datasourceInfo = await getDatasourceInfo({ schemaPath })
    printDatasource({ datasourceInfo })

    process.stdout.write('\n') // empty line

    // Validate schema (same as prisma validate)
    validate({
      schemas,
    })

    await getConfig({
      datamodel: schemas,
      ignoreEnvVarErrors: false,
    })

    // Automatically create the database if it doesn't exist
    const wasDbCreated = await ensureDatabaseExists('create', schemaPath)

    if (wasDbCreated) {
      process.stdout.write(wasDbCreated + '\n\n')
    }

    const migrate = new Migrate(schemaPath)

    let migrationName: undefined | string = undefined

    const getMigrationNameResult = await getMigrationName(args['--name'])

    if (getMigrationNameResult.userCancelled) {
      process.stdout.write(getMigrationNameResult.userCancelled + '\n')
      migrate.stop()
      // Return SIGINT exit code to signal that the process was cancelled.
      process.exit(130)
    } else {
      migrationName = getMigrationNameResult.name
    }

    try {
      const createMigrationResult = await migrate.createMigration({
        migrationsDirectoryPath: migrate.migrationsDirectoryPath!,
        migrationName: migrationName ?? '',
        draft: true,
        // Passing an empty prismaSchema will create an empty migration.
        prismaSchema: '',
      })

      debug({ createMigrationResult })

      process.stdout.write(
        `\nThe following migration have been created:\n\n${printMigrationId(
          createMigrationResult.generatedMigrationName!,
        )}\n\nYou can now edit it and apply it by running ${green(getCommandWithExecutor('prisma migrate dev'))}`,
      )
    } finally {
      migrate.stop()
    }

    return ''
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${MigrateNew.help}`)
    }

    return MigrateNew.help
  }
}
