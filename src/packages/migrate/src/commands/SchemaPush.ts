import { arg, Command, format, HelpError, isError } from '@prisma/sdk'
import chalk from 'chalk'
import { Migrate, PushOptions } from '../Migrate'
import { ensureDatabaseExists } from '../utils/ensureDatabaseExists'
import { ExperimentalFlagError } from '../utils/experimental'
import { formatms } from '../utils/formatms'

export class SchemaPush implements Command {
  public static new(): SchemaPush {
    return new SchemaPush()
  }

  // static help template
  private static help = format(`
    Push the state from your schema.prisma to your database

    ${chalk.bold.yellow('WARNING')} ${chalk.bold(
    "Prisma's schema push functionality is currently in an experimental state.",
  )}
    ${chalk.dim(
      'When using any of the commands below you need to explicitly opt-in via the --experimental flag.',
    )}

    ${chalk.bold('Usage')}

      ${chalk.dim('$')} prisma schema push --experimental

    ${chalk.bold('Options')}

      --force           Ignore data loss warnings
      -c, --create-db   Create the database in case it doesn't exist
      -h, --help        Displays this help message

    ${chalk.bold('Examples')}

      Push the local schema state to the database
      ${chalk.dim('$')} prisma schema push --experimental

      Using --force to ignore data loss warnings
      ${chalk.dim('$')} prisma schema push --force --experimental
  `)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(
      argv,
      {
        '--help': Boolean,
        '-h': '--help',
        '--create-db': Boolean,
        '-c': '--create-db',
        '--force': Boolean,
        '--experimental': Boolean,
        '--schema': String,
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

    const migrate = new Migrate(args['--schema'])

    const options: PushOptions = {
      force: args['--force'],
    }

    await ensureDatabaseExists('push', args['--create-db'], args['--schema'])

    const before = Date.now()
    const migration = await migrate.push(options)
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
        console.log(
          chalk.bold(`  Use the --force flag to ignore these warnings.`),
        )
        return ''
      }
    }

    if (migration.warnings.length === 0 && migration.executedSteps === 0) {
      return `\nThe database is already in sync with the Prisma schema.`
    } else {
      return `\n${
        process.platform === 'win32' ? '' : chalk.bold.green('🚀  ')
      } Done in ${formatms(Date.now() - before)}`
    }
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${SchemaPush.help}`,
      )
    }
    return SchemaPush.help
  }
}
