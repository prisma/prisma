import { arg, Command, Commands, format, HelpError, isError, unknownCommand } from '@prisma/internals'
import { bold, red } from 'kleur/colors'

import { EarlyAccessFlagError } from '../../../migrate/src/utils/flagErrors'

export class $ implements Command {
  public static new(commands: Commands): $ {
    return new $(commands)
  }

  private static help = format(`
    TODO
  `)

  private constructor(private readonly commands: Commands) {}

  public async parse(argv: string[]) {
    const isHasEarlyAccessFeatureFlag = Boolean(argv.find((_) => _.match(/early-access-feature/)))
    if (!isHasEarlyAccessFeatureFlag) throw new EarlyAccessFlagError()

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

    const commandName = args._[0]
    const command = this.commands[commandName]
    if (command) {
      return command.parse([])
    }

    return unknownCommand($.help, commandName)
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${$.help}`)
    }
    return $.help
  }
}
