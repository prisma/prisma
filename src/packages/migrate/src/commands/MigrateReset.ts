import {
  arg,
  Command,
  format,
  getCommandWithExecutor,
  getSchemaPath,
  HelpError,
  isError,
} from '@prisma/sdk'
import chalk from 'chalk'
import path from 'path'
import prompt from 'prompts'
import { Migrate } from '../Migrate'
import { ExperimentalFlagError } from '../utils/experimental'

export class MigrateReset implements Command {
  public static new(): MigrateReset {
    return new MigrateReset()
  }

  private static help = format(`
    Reset your database and reapply migrations

    ${chalk.bold.yellow('WARNING')} ${chalk.bold(
    "Prisma's migration functionality is currently in an experimental state.",
  )}
    ${chalk.dim(
      'When using any of the commands below you need to explicitly opt-in via the --experimental flag.',
    )}

    ${chalk.bold('Usage')}

      ${chalk.dim('$')} prisma migrate reset --experimental

    ${chalk.bold('Options')}

      -h, --help       Displays this help message
      -f, --force      Skip the confirmation prompt

  `)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--force': Boolean,
      '-f': '--force',
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
        `Prisma Schema loaded from ${path.relative(process.cwd(), schemaPath)}`,
      ),
    )

    if (!args['--force']) {
      const confirmation = await prompt({
        type: 'confirm',
        name: 'value',
        message: `Are you sure you want to reset your database? ${chalk.red(
          'All data will be lost',
        )}.`,
      })

      if (!confirmation.value) {
        console.info('Reset cancelled.')
        process.exit(0)
      }
    }

    const migrate = new Migrate(schemaPath)
    await migrate.reset()
    await migrate.stop()

    return `Reset successful.`
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${MigrateReset.help}`,
      )
    }
    return MigrateReset.help
  }
}
