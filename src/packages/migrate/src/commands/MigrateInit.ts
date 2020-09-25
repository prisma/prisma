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
import { Migrate } from '../Migrate'
import { ensureDatabaseExists } from '../utils/ensureDatabaseExists'
import { ExperimentalFlagError } from '../utils/experimental'

export class MigrateInit implements Command {
  public static new(): MigrateInit {
    return new MigrateInit()
  }

  private static help = format(`
    Initialize migrations

    ${chalk.bold.yellow('WARNING')} ${chalk.bold(
    "Prisma's migration functionality is currently in an experimental state.",
  )}
    ${chalk.dim(
      'When using any of the commands below you need to explicitly opt-in via the --experimental flag.',
    )}

    ${chalk.bold('Usage')}

      ${chalk.dim('$')} prisma migrate init --experimental

    ${chalk.bold('Options')}

      -h, --help       Displays this help message

  `)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
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

    console.info(
      chalk.dim(
        `Prisma Schema loaded from ${path.relative(process.cwd(), schemaPath)}`,
      ),
    )

    // Automatically create the database if it doesn't exist
    await ensureDatabaseExists('create', true, schemaPath)

    const migrate = new Migrate(schemaPath)
    await migrate.initialize()
    // after engine init is implemented
    // migrate.stop()

    return `\nInitialization complete.\n\nRun ${chalk.greenBright(
      getCommandWithExecutor('prisma migrate --experimental'),
    )} to create your first migration\n`
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${MigrateInit.help}`,
      )
    }
    return MigrateInit.help
  }
}
