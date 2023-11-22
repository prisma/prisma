import { Command, Commands, format, HelpError } from '@prisma/internals'
import { bold, red } from 'kleur/colors'

import { EarlyAccessFlagError } from '../../../migrate/src/utils/flagErrors'
import { dispatchToSubCommand } from '../utils/platform'

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
    const result = await dispatchToSubCommand(this.commands, argv)
    return JSON.stringify(result)
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${$.help}`)
    }
    return $.help
  }
}
