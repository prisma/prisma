import {
  arg,
  Command,
  Commands,
  format,
  HelpError,
  isError,
  unknownCommand,
} from '@prisma/sdk'
import chalk from 'chalk'
import { getNextFreePort } from '../utils/occupyPath'

/**
 * Migrate command
 */
export class MigrateCommand implements Command {
  public static new(cmds: Commands): MigrateCommand {
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

    ${chalk.bold('Commands')}

        save   Create a new migration
          up   Migrate your database up
        down   Migrate your database down

    ${chalk.bold('Examples')}

      Create new migration
      ${chalk.dim('$')} prisma migrate save --experimental

      Migrate up to the latest datamodel
      ${chalk.dim('$')} prisma migrate up --experimental

      Preview the next migration without migrating
      ${chalk.dim('$')} prisma migrate up --preview --experimental

      Rollback a migration
      ${chalk.dim('$')} prisma migrate down 1 --experimental

      Get more help on a migrate up
      ${chalk.dim('$')} prisma migrate up -h --experimental
  `)
  private constructor(private readonly cmds: Commands) {}

  public async parse(argv: string[]): Promise<string | Error> {
    // parse the arguments according to the spec
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--experimental': Boolean,
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
      const nextFreePort = await getNextFreePort(process.cwd())
      if (typeof nextFreePort !== 'number') {
        const command = `prisma migrate ${argv.join(' ')}`
        throw new Error(`Cannot run ${chalk.bold(
          command,
        )} because there is a ${chalk.bold(
          'prisma dev',
        )} command running in this directory.
Please ${chalk.rgb(
          228,
          155,
          15,
        )(
          `stop ${chalk.bold('prisma dev')} first`,
        )}, then try ${chalk.greenBright.bold(command)} again`)
      }

      const argsForCmd = args['--experimental']
        ? [...args._.slice(1), `--experimental=${args['--experimental']}`]
        : args._.slice(1)
      return cmd.parse(argsForCmd)
    }

    return unknownCommand(MigrateCommand.help, args._[0])
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
