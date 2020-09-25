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
import { printMigrationId } from '../utils/printMigrationId'
import { printFiles } from '../utils/printFiles'

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

  private argsSpec = {
    '--help': Boolean,
    '-h': '--help',
    '--name': String,
    '-n': '--name',
    '--force': Boolean,
    '-f': '--force',
    '--draft': Boolean,
    '--schema': String,
    '--experimental': Boolean,
    '--telemetry-information': String,
  }

  private constructor(private readonly cmds?: Commands) {}

  public async parse(argv: string[]): Promise<string | Error> {
    // parse the arguments according to the spec
    const args = arg(argv, this.argsSpec)

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

      return await this.migrate(argv)
    }
  }

  // All-in-One command
  public async migrate(argv: string[]): Promise<string> {
    // parse the arguments according to the spec
    const args = arg(argv, this.argsSpec)

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
        `Prisma Schema loaded from ${path.relative(process.cwd(), schemaPath)}`,
      ),
    )

    // Automatically create the database if it doesn't exist
    const wasDbCreated = await ensureDatabaseExists('create', true, schemaPath)
    if (wasDbCreated) {
      console.info()
      console.info(wasDbCreated)
    }

    const migrate = new Migrate(schemaPath)

    if (!(await migrate.checkMigrationsDirectory())) {
      throw new Error(
        `You need to initialize the migrations by running ${chalk.greenBright(
          getCommandWithExecutor('prisma migrate init --experimental'),
        )}.`,
      )
    }

    if (args['--draft']) {
      const migrationName = await this.getMigrationName(args['--name'])
      const migrationId = await migrate.draft({
        name: migrationName,
      })
      migrate.stop()

      if (migrationId) {
        // return `${migrationId}`
        return `\nPrisma Migrate created a draft migration ${printMigrationId(
          migrationId,
        )}\n\nYou can now edit it and then apply it by running ${chalk.greenBright(
          getCommandWithExecutor('prisma migrate --experimental'),
        )} again.`
      } else {
        return `\nNo migration was created. Your Prisma schema and database are already in sync.\n`
      }
    }

    const historyDiagnostics = await migrate.checkHistory()

    if (historyDiagnostics) {
      // if reset needed
      const reset = await migrate.reset()
      console.debug({ reset })
    }

    const planMigrationResult = await migrate.plan()
    console.debug({ planMigrationResult })

    if (
      planMigrationResult.unexecutableSteps &&
      planMigrationResult.unexecutableSteps.length > 0
    ) {
      const messages: string[] = []
      messages.push(
        `${chalk.bold.red('\n⚠️ We found changes that cannot be executed:\n')}`,
      )
      for (const item of planMigrationResult.unexecutableSteps) {
        messages.push(`${chalk(`  • ${item}`)}`)
      }
      console.info() // empty line
      // Exit
      throw new Error(`${messages.join('\n')}\n`)
    }

    if (
      planMigrationResult.warnings &&
      planMigrationResult.warnings.length > 0
    ) {
      console.log(
        chalk.bold(
          `\n\n⚠️  There will be data loss when applying the migration:\n`,
        ),
      )
      for (const warning of planMigrationResult.warnings) {
        console.log(chalk(`  • ${warning.message}`))
      }
      console.info() // empty line

      if (this.isInteractiveTerminal()) {
        const confirmation = await prompt({
          type: 'confirm',
          name: 'value',
          message: `Are you sure you want create and apply this migration? ${chalk.red(
            'Some data will be lost',
          )}.`,
        })

        if (!confirmation.value) {
          console.info('Migration cancelled.')
          process.exit(0)
        }
      } else {
        if (!args['--force']) {
          console.info(
            `Migration cancelled. (Non interactive environnment detected)
            Use the --force flag ignore the dataloss warnings.`,
          )
          process.exit(0)
        }
      }
    }

    const migrationName = await this.getMigrationName(args['--name'])
    console.debug({ migrationName })

    const migrationIds = await migrate.createAndApply({
      name: migrationName,
    })
    migrate.stop()

    // if (!process.env.SKIP_GENERATE) {
    //   // call prisma generate
    // }
    console.debug({ migrationIds })
    // return `${migrationIds}`

    return `\nPrisma Migrate created and applied the migration ${printMigrationId(
      migrationIds[0],
    )} in\n\n${chalk.dim(
      printFiles(`migrations/${migrationIds[0]}`, {
        'migration.sql': '',
      }),
    )}\n\n`
  }

  private isInteractiveTerminal() {
    return process.stdout.isTTY && !isCi && !process.env.GITHUB_ACTIONS
  }

  private async getMigrationName(name?: string): Promise<string> {
    if (name) {
      return name
    } else if (!this.isInteractiveTerminal()) {
      return ''
    }

    const response = await prompt({
      type: 'text',
      name: 'name',
      message: `Name of migration`,
    })
    return response.name || ''
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
