import { Command, Commands } from '@prisma/internals'

import { EarlyAccessFlagError } from '../utils/errors'
import { dispatchToSubCommand } from '../utils/platform'

export class $ implements Command {
  public static new(commands: Commands): $ {
    return new $(commands)
  }

  private constructor(private readonly commands: Commands) {}

  public async parse(argv: string[]) {
    const isHasEarlyAccessFeatureFlag = Boolean(argv.find((_) => _.match(/early-access/)))
    if (!isHasEarlyAccessFeatureFlag) throw new EarlyAccessFlagError()

    // Since `dispatchToSubCommand`
    // assumes that the first element of the array to be the command
    // we must remove the flag before
    //
    // It makes it possible to run, for example:
    // prisma platform --early-access login
    // prisma platform login --early-access
    const argvWithoutEarlyAccess = (argv = argv.filter((it) => it !== '--early-access'))

    const result = await dispatchToSubCommand(this.commands, argvWithoutEarlyAccess)

    return result
  }
}
