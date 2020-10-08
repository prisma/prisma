import {
  arg,
  Command,
  format,
  getSchemaPath,
  HelpError,
  isError,
} from '@prisma/sdk'
import chalk from 'chalk'
import path from 'path'
import { Migrate } from '../Migrate'
import { ensureDatabaseExists } from '../utils/ensureDatabaseExists'
import { ExperimentalFlagError } from '../utils/experimental'

export class MigrateUp implements Command {
  public static new(): MigrateUp {
    return new MigrateUp()
  }

  // static help template
  private static help = format(`
    Migrate your database up to a specific state.

    ${chalk.bold.yellow('WARNING')} ${chalk.bold(
    "Prisma's migration functionality is currently in an experimental state.",
  )}
    ${chalk.dim(
      'When using any of the commands below you need to explicitly opt-in via the --experimental flag.',
    )}

    ${chalk.bold('Usage')}

      ${chalk.dim('$')} prisma migrate up --experimental


    ${chalk.bold('Options')}

      -h, --help            Displays this help message
      --dev                 Checks thedatabase state and interactively ask to reset if needed before applying migrations.
      --prod, --production  Applies unapplied migrations only.

  `)

  // parse arguments
  public async parse(argv: string[]): Promise<string | Error> {
    // parse the arguments according to the spec
    const args = arg(
      argv,
      {
        '--help': Boolean,
        '-h': '--help',
        '--experimental': Boolean,
        '--dev': Boolean,
        '--production': Boolean,
        '-prod': '--production',
        '--schema': String,
        '--telemetry-information': String,
      },
      false,
    )

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

    const migrate = new Migrate(schemaPath)

    await ensureDatabaseExists('apply', true, schemaPath)

    const result = await migrate.up()
    migrate.stop()

    return ``
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${MigrateUp.help}`,
      )
    }
    return MigrateUp.help
  }
}
