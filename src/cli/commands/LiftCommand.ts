import { arg, Command, Commands, format, HelpError, isError, unknownCommand } from '@prisma/cli'
import chalk from 'chalk'
import { getNextFreePort } from '../../utils/occupyPath'
import { gamboge } from '../highlight/theme'

/**
 * Migrate command
 */
export class LiftCommand implements Command {
  public static new(cmds: Commands): LiftCommand {
    return new LiftCommand(cmds)
  }

  // static help template
  private static help = format(`
    ${chalk.bold('🏋️')}‍‍‍  Migrate your database with confidence

    ${chalk.bold('Usage')}

      prisma2 lift [command] [options]

    ${chalk.bold('Options')}

      -h, --help   Display this help message

    ${chalk.bold('Commands')}

        save   Create a new migration
        docs   Open documentation in the browser
        down   Migrate your database down
          up   Migrate your database up

    ${chalk.bold('Examples')}

      Create new migration
      ${chalk.dim(`$`)} prisma2 lift save

      Migrate up to the latest datamodel
      ${chalk.dim(`$`)} prisma2 lift

      Preview the next migration without migrating
      ${chalk.dim(`$`)} prisma2 lift up --preview

      Rollback a migration
      ${chalk.dim(`$`)} prisma2 lift down 1

      Get more help on a lift up
      ${chalk.dim(`$`)} prisma2 lift up -h
  `)
  private constructor(private readonly cmds: Commands) {}

  public async parse(argv: string[]): Promise<string | Error> {
    // parse the arguments according to the spec
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
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
        const command = `prisma2 lift ${argv.join(' ')}`
        throw new Error(`Cannot run ${chalk.bold(command)} because there is a ${chalk.bold(
          'prisma2 dev',
        )} command running in this directory.
Please ${gamboge(`stop ${chalk.bold('prisma2 dev')} first`)}, then try ${chalk.greenBright.bold(command)} again`)
      }
      return cmd.parse(args._.slice(1))
    }

    return unknownCommand(LiftCommand.help, args._[0])
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${LiftCommand.help}`)
    }
    return LiftCommand.help
  }
}
