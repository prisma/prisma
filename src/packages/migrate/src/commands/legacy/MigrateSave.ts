import {
  arg,
  Command,
  format,
  getCommandWithExecutor,
  getSchema,
  getSchemaDir,
  getSchemaPath,
  HelpError,
  isError,
} from '@prisma/sdk'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import prompt from 'prompts'
import { promisify } from 'util'
import { Migrate } from '../../Migrate'
import { ensureDatabaseExists } from '../../utils/ensureDatabaseExists'
import { ExperimentalFlagError } from '../../utils/flagErrors'
import { printFiles } from '../../utils/printFiles'
import { printMigrationId } from '../../utils/printMigrationId'
import { serializeFileMap } from '../../utils/serializeFileMap'

const writeFile = promisify(fs.writeFile)

/**
 * $ prisma migrate save
 */
export class MigrateSave implements Command {
  public static new(): MigrateSave {
    return new MigrateSave()
  }

  // static help template
  private static help = format(`
    Save a migration

    ${chalk.bold.yellow('WARNING')} ${chalk.bold(
    "Prisma's migration functionality is currently in an experimental state.",
  )}
    ${chalk.dim(
      'When using any of the commands below you need to explicitly opt-in via the --experimental flag.',
    )}

    ${chalk.bold('Usage')}

      ${chalk.dim('$')} prisma migrate save [options] --experimental

    ${chalk.bold('Options')}

      -h, --help       Display this help message
      -n, --name       Name the migration
      -c, --create-db  Create the database in case it doesn't exist
      -p, --preview    Get a preview of which migration would be created next

    ${chalk.bold('Examples')}

      Create a new migration
      ${chalk.dim('$')} prisma migrate save --experimental

      Create a new migration by name
      ${chalk.dim(
        '$',
      )} prisma migrate save --name "add unique to email" --experimental

  `)

  // parse arguments
  public async parse(argv: string[]): Promise<string | Error> {
    // parse the arguments according to the spec
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--name': String,
      '-n': '--name',
      '--preview': Boolean,
      '-p': '--preview',
      '--create-db': Boolean,
      '-c': '--create-db',
      '--experimental': Boolean,
      '--schema': String,
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    if (!args['--experimental']) {
      throw new ExperimentalFlagError()
    }

    const preview = args['--preview'] || false
    const schemaPath = await getSchemaPath(args['--schema'])

    if (!schemaPath) {
      throw new Error(
        `Could not find a ${chalk.bold(
          'schema.prisma',
        )} file that is required for this command.\nYou can either provide it with ${chalk.greenBright(
          '--schema',
        )}, set it as \`prisma.schema\` in your package.json or put it into the default location ${chalk.greenBright(
          './prisma/schema.prisma',
        )} https://pris.ly/d/prisma-schema-location`,
      )
    }

    console.info(
      chalk.dim(
        `Prisma schema loaded from ${path.relative(process.cwd(), schemaPath)}`,
      ),
    )

    await ensureDatabaseExists('create', args['--create-db'], schemaPath)

    const migrate = new Migrate(schemaPath)

    const migration = await migrate.createMigrationLegacy('DUMMY_NAME')

    if (!migration) {
      migrate.stop()
      return `Everything up-to-date\n` // TODO: find better wording
    }

    const name = preview ? args['--name'] : await this.name(args['--name'])

    const { files, newLockFile, migrationId } = await migrate.save(
      migration,
      name,
      preview,
    )
    migrate.stop()

    if (
      migration.unexecutableMigrations &&
      migration.unexecutableMigrations.length > 0
    ) {
      const messages: string[] = []
      messages.push(
        `${chalk.bold(
          '\n\n⚠️ We found migration(s) that cannot be executed:\n',
        )}`,
      )
      for (const item of migration.unexecutableMigrations) {
        messages.push(`${chalk(`  • ${item.description}`)}`)
      }
      console.log() // empty line
      throw new Error(`${messages.join('\n')}\n`)
    }

    if (migration.warnings && migration.warnings.length > 0) {
      console.log(
        chalk.bold(
          `\n\n⚠️  There might be data loss when applying the migration:\n`,
        ),
      )
      for (const warning of migration.warnings) {
        console.log(chalk(`  • ${warning.description}`))
      }
      console.log() // empty line
    }

    if (preview) {
      return `\nRun ${chalk.greenBright(
        getCommandWithExecutor(
          'prisma migrate save --name MIGRATION_NAME --experimental',
        ),
      )} to create the migration\n`
    }

    await getSchema(schemaPath) // just to leverage on its error handling
    const schemaDir = (await getSchemaDir(schemaPath))! // TODO: Probably getSchemaDir() should return Promise<string> instead of Promise<string | null>

    const migrationsDir = path.join(schemaDir, 'migrations', migrationId)
    await serializeFileMap(files, migrationsDir)
    const lockFilePath = path.join(schemaDir, 'migrations', 'migrate.lock')
    await writeFile(lockFilePath, newLockFile)

    return `\nPrisma Migrate just created your migration ${printMigrationId(
      migrationId,
    )} in\n\n${chalk.dim(
      printFiles(`migrations/${migrationId}`, files),
    )}\n\nRun ${chalk.greenBright(
      getCommandWithExecutor('prisma migrate up --experimental'),
    )} to apply the migration\n`
  }

  // get the name
  public async name(name?: string): Promise<string | undefined> {
    if (name === '') {
      return undefined
    }
    if (name) {
      return name
    }
    const response = await prompt({
      type: 'text',
      name: 'name',
      message: `Name of migration`,
    })
    return response.name || undefined
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${MigrateSave.help}`,
      )
    }
    return MigrateSave.help
  }
}
