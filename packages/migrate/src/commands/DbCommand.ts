import type { Command, Commands } from '@prisma/sdk'
import { arg, format, HelpError, isError, unknownCommand } from '@prisma/sdk'
import chalk from 'chalk'

export class DbCommand implements Command {
  public static new(cmds: Commands): DbCommand {
    return new DbCommand(cmds)
  }

  private static help = format(`
${process.platform === 'win32' ? '' : chalk.bold('🏋️  ')}Manage your database schema and lifecycle during development.

${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma db [command] [options]

${chalk.bold('Options')}

  -h, --help   Display this help message
    --schema   Custom path to your Prisma schema

${chalk.bold('Commands')}
        pull   Pull the state from the database to the Prisma schema using introspection
        push   Push the state from Prisma schema to the database during prototyping
        seed   Seed your database
     execute   Execute native commands to your database (Preview)

${chalk.bold('Examples')}

  Using prisma db pull
  ${chalk.dim('$')} prisma db pull

  Using prisma db push
  ${chalk.dim('$')} prisma db push

  Using prisma db seed
  ${chalk.dim('$')} prisma db seed

  Using prisma db execute (Preview)
  ${chalk.dim('$')} prisma db execute --preview-feature --file ./script.sql --schema schema.prisma
`)

  private constructor(private readonly cmds: Commands) {}

  /* eslint-disable-next-line @typescript-eslint/require-await */
  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--preview-feature': Boolean,
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    // display help for help flag or no subcommand
    if (args._.length === 0 || args['--help']) {
      return this.help()
    }

    // check if we have that subcommand
    const cmd = this.cmds[args._[0]]
    if (cmd) {
      const argsForCmd = args['--preview-feature'] ? [...args._.slice(1), `--preview-feature`] : args._.slice(1)
      return cmd.parse(argsForCmd)
    }

    return unknownCommand(DbCommand.help, args._[0])
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${DbCommand.help}`)
    }
    return DbCommand.help
  }
}
