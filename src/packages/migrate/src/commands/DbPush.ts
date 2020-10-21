import {
  arg,
  Command,
  format,
  HelpError,
  isError,
  getSchemaPath,
  getCommandWithExecutor,
} from '@prisma/sdk'
import path from 'path'
import chalk from 'chalk'
import { Migrate } from '../Migrate'
import { ensureDatabaseExists } from '../utils/ensureDatabaseExists'
import { formatms } from '../utils/formatms'

export class DbPush implements Command {
  public static new(): DbPush {
    return new DbPush()
  }

  private static help = format(`
    Push the state from your schema.prisma to your database

    ${chalk.bold('Usage')}

      ${chalk.dim('$')} prisma db push

    ${chalk.bold('Options')}

      -h, --help       Displays this help message
      -f, --force      Ignore data loss warnings

    ${chalk.bold('Examples')}

      Push the local schema state to the database
      ${chalk.dim('$')} prisma db push

      Using --force to ignore data loss warnings
      ${chalk.dim('$')} prisma db push --force
  `)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(
      argv,
      {
        '--help': Boolean,
        '-h': '--help',
        '--force': Boolean,
        '-f': '--force',
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

    const migrate = new Migrate(args['--schema'])

    await ensureDatabaseExists('push', true, args['--schema'])

    const before = Date.now()
    const migration = await migrate.push({
      force: args['--force'],
    })
    migrate.stop()

    if (migration.unexecutable && migration.unexecutable.length > 0) {
      const messages: string[] = []
      messages.push(
        `${chalk.bold.red('\n⚠️ We found changes that cannot be executed:\n')}`,
      )
      for (const item of migration.unexecutable) {
        messages.push(`${chalk(`  • ${item}`)}`)
      }
      console.log() // empty line
      throw new Error(`${messages.join('\n')}\n`)
    }

    if (migration.warnings && migration.warnings.length > 0) {
      console.log(
        chalk.bold.yellow(
          `\n⚠️  There might be data loss when applying the changes:\n`,
        ),
      )

      for (const warning of migration.warnings) {
        console.log(chalk(`  • ${warning}`))
      }
      console.log() // empty line

      if (!args['--force']) {
        throw Error(
          chalk.bold(
            `Use the --force flag to ignore these warnings like ${chalk.bold.greenBright(
              getCommandWithExecutor('prisma db push --force'),
            )}`,
          ),
        )
      }
    }

    if (migration.warnings.length === 0 && migration.executedSteps === 0) {
      return `\nThe database is already in sync with the Prisma schema.\n`
    } else {
      return `\n${
        process.platform === 'win32' ? '' : '🚀  '
      }Your database is now in sync with your schema. Done in ${formatms(
        Date.now() - before,
      )}\n`
    }
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${DbPush.help}`)
    }
    return DbPush.help
  }
}
