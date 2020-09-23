import {
  arg,
  Command,
  Commands,
  format,
  HelpError,
  isError,
  unknownCommand,
  getSchemaPath,
  getCommandWithExecutor,
} from '@prisma/sdk'
import chalk from 'chalk'
import prompt from 'prompts'
import isCi from 'is-ci'
import fs from 'fs'
import path from 'path'
import { Migrate } from '../Migrate'
import { ensureDatabaseExists } from '../utils/ensureDatabaseExists'
import { ExperimentalFlagError } from '../utils/experimental'

/**
 * Migrate command
 */
export class MigrateCommand implements Command {
  public static new(cmds?: Commands): MigrateCommand {
    return new MigrateCommand(cmds)
  }

  // static help template
  private static help = format(`
    ${
      process.platform === 'win32' ? '' : chalk.bold('🏋️  ')
    }Migrate your database with confidence

    ${chalk.bold.yellow('WARNING')} ${chalk.bold(
    "Prisma's migration functionality is currently in an experimental state.",
  )}
    ${chalk.dim(
      'When using any of the commands below you need to explicitly opt-in via the --experimental flag.',
    )}

    ${chalk.bold('Usage')}

      With an existing schema.prisma:
      ${chalk.dim('$')} prisma migrate [command] [options] --experimental

      Or specify a schema:
      ${chalk.dim(
        '$',
      )} prisma migrate [command] [options] --experimental --schema=./schema.prisma

    ${chalk.bold('Options')}

      -h, --help   Display this help message
      -n, --name   Name the migration

    ${chalk.bold('Commands')}

        save   Create a new migration
          up   Migrate your database up
        down   Migrate your database down

    ${chalk.bold('Examples')}

      Create new migration and apply it
      ${chalk.dim('$')} prisma migrate --experimental

      Migrate up to the latest datamodel
      ${chalk.dim('$')} prisma migrate up --experimental

      Preview the next migration without migrating
      ${chalk.dim('$')} prisma migrate up --preview --experimental

      Rollback a migration
      ${chalk.dim('$')} prisma migrate down 1 --experimental

      Get more help on a migrate up
      ${chalk.dim('$')} prisma migrate up -h --experimental
  `)
  private constructor(private readonly cmds?: Commands) {}

  public async parse(argv: string[]): Promise<string | Error> {
    // parse the arguments according to the spec
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--name': String,
      '-n': '--name',
      '--draft': Boolean,
      '--experimental': Boolean,
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    // running a subcommand
    if (args._[0] && this.cmds) {
      // check if we have that subcommand
      const cmd = this.cmds[args._[0]]
      if (cmd) {
        const argsForCmd = args['--experimental']
          ? [...args._.slice(1), `--experimental=${args['--experimental']}`]
          : args._.slice(1)
        return cmd.parse(argsForCmd)
      }

      return unknownCommand(MigrateCommand.help, args._[0])
    } else {
      // prisma migrate
      if (!args['--experimental']) {
        throw new ExperimentalFlagError()
      }

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

      console.log(
        chalk.dim(
          `Prisma Schema loaded from ${path.relative(
            process.cwd(),
            schemaPath,
          )}`,
        ),
      )

      // Automtically create the database if it doesn't exist
      await ensureDatabaseExists('create', true, schemaPath)

      const migrate = new Migrate(schemaPath)

      let migrationName: string | undefined
      if (process.stdout.isTTY && !isCi && !process.env.GITHUB_ACTIONS) {
        migrationName = await this.promptForMigrationName()
      }

      const result = await migrate.migrate({
        draft: args['--draft'],
        name: migrationName,
      })
      await migrate.stop()

      return `\nSuccess!\n`
    }
  }

  public async promptForMigrationName(
    name?: string,
  ): Promise<string | undefined> {
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

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${MigrateCommand.help}`,
      )
    }
    return MigrateCommand.help
  }
}
