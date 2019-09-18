import { arg, Command, Env, format, HelpError, isError } from '@prisma/cli'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import prompt from 'prompts'
import { promisify } from 'util'
import { Lift } from '../../Lift'
import { canConnectToDatabase } from '../../liftEngineCommands'
import { ensureDatabaseExists } from '../../utils/ensureDatabaseExists'
import { printFiles } from '../../utils/printFiles'
import { printMigrationId } from '../../utils/printMigrationId'
import { serializeFileMap } from '../../utils/serializeFileMap'

const writeFile = promisify(fs.writeFile)

/**
 * $ prisma migrate new
 */
export class LiftSave implements Command {
  public static new(env: Env): LiftSave {
    return new LiftSave(env)
  }

  // static help template
  private static help = format(`
    Save a migration

    ${chalk.bold('Usage')}

      prisma migrate save [options]

    ${chalk.bold('Options')}

      -h, --help       Displays this help message
      -n, --name       Name the migration
      -c, --create-db  Create the database in case it doesn't exist

    ${chalk.bold('Examples')}

      Create a new migration
      ${chalk.dim(`$`)} prisma migrate save

      Create a new migration by name
      ${chalk.dim(`$`)} prisma migrate save --name "add unique to email"

  `)
  private constructor(private readonly env: Env) {}

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
    })
    if (isError(args)) {
      return this.help(args.message)
    } else if (args['--help']) {
      return this.help()
    }
    const preview = args['--preview'] || false
    await ensureDatabaseExists('create', args['--create-db'])

    const lift = new Lift(this.env.cwd)

    const migration = await lift.createMigration('DUMMY_NAME')

    if (!migration) {
      lift.stop()
      return `Everything up-to-date\n` // TODO: find better wording
    }

    const name = preview ? args['--name'] : await this.name(args['--name'])

    const { files, newLockFile, migrationId } = await lift.save(migration, name, preview)

    if (preview) {
      lift.stop()
      return `\nRun ${chalk.greenBright('prisma lift save --name MIGRATION_NAME')} to create the migration\n`
    }

    const migrationsDir = path.join(this.env.cwd, 'migrations', migrationId)
    await serializeFileMap(files, migrationsDir)
    const lockFilePath = path.join(this.env.cwd, 'migrations', 'lift.lock')
    await writeFile(lockFilePath, newLockFile)

    lift.stop()

    return `\nLift just created your migration ${printMigrationId(migrationId)} in\n\n${chalk.dim(
      printFiles(`migrations/${migrationId}`, files),
    )}\n\nRun ${chalk.greenBright('prisma2 lift up')} to apply the migration\n`
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
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${LiftSave.help}`)
    }
    return LiftSave.help
  }
}
