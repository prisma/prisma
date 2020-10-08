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
  isCi,
} from '@prisma/sdk'
import chalk from 'chalk'
import prompt from 'prompts'
import path from 'path'
import { Migrate } from '../Migrate'
import { ensureDatabaseExists } from '../utils/ensureDatabaseExists'
import { ExperimentalFlagError } from '../utils/experimental'
import { printMigrationId, printMigrationIds } from '../utils/printMigrationId'
import { printFiles, printFilesFromMigrationIds } from '../utils/printFiles'

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

          init    Initalize project for migrations
          up      Migrate your database up
          reset   Reset your database. All data will be lost. 

    ${chalk.bold('Examples')}

      Create new migration and apply it
      ${chalk.dim('$')} prisma migrate --experimental
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
        return `\nPrisma Migrate created a draft migration ${printMigrationId(
          migrationId,
        )}\n\nYou can now edit it and then apply it by running ${chalk.greenBright(
          getCommandWithExecutor('prisma migrate --experimental'),
        )} again.`
      } else {
        return `\nNo migration was created. Your Prisma schema and database are already in sync.\n`
      }
    }

    await migrate.checkHistoryAndReset({ force: args['--force'] })

    const evaluateDataLossResult = await migrate.evaluateDataLoss()
    if (
      evaluateDataLossResult.unexecutableSteps &&
      evaluateDataLossResult.unexecutableSteps.length > 0
    ) {
      const messages: string[] = []
      messages.push(
        `${chalk.bold.red('\n⚠️ We found changes that cannot be executed:\n')}`,
      )
      for (const item of evaluateDataLossResult.unexecutableSteps) {
        messages.push(`${chalk(`  • ${item}`)}`)
      }
      console.info() // empty line
      // Exit
      throw new Error(`${messages.join('\n')}\n`)
    }

    if (
      evaluateDataLossResult.warnings &&
      evaluateDataLossResult.warnings.length > 0
    ) {
      console.log(
        chalk.bold(
          `\n\n⚠️  There will be data loss when applying the migration:\n`,
        ),
      )
      for (const warning of evaluateDataLossResult.warnings) {
        console.log(chalk(`  • ${warning.message}`))
      }
      console.info() // empty line

      if (!args['--force']) {
        if (isCi) {
          throw Error(
            `Use the --force flag to use the migrate command in an unnattended environment like ${chalk.bold.greenBright(
              getCommandWithExecutor('prisma migrate --force --experimental'),
            )}`,
          )
        } else {
          const confirmation = await prompt({
            type: 'confirm',
            name: 'value',
            message: `Are you sure you want create and apply this migration? ${chalk.red(
              'Some data will be lost',
            )}.`,
          })

          if (!confirmation.value) {
            return `Migration cancelled.`
          }
        }
      }
    }

    const migrationName =
      evaluateDataLossResult.migrationSteps.length > 0
        ? await this.getMigrationName(args['--name'])
        : undefined

    const migrationIds = await migrate.createAndApply({
      name: migrationName,
    })
    migrate.stop()

    // if (!process.env.SKIP_GENERATE) {
    //   // call prisma generate
    // }

    if (migrationIds.length === 0) {
      return `\nEverything is already in sync, Prisma Migrate didn't find any schema changes or unapplied migrations.\n`
    } else {
      return `\nPrisma Migrate applied the following migration(s):\n\n${chalk.dim(
        printFilesFromMigrationIds('migrations', migrationIds, {
          'migration.sql': '',
        }),
      )}\n`
    }
  }

  private async getMigrationName(name?: string): Promise<string> {
    if (name) {
      return name
    } else if (isCi) {
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
