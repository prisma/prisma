import { arg, Command, Commands, isError } from '@prisma/internals'

import { EarlyAccessFlagError } from '../../../migrate/src/utils/flagErrors'
import { dispatchToSubCommand } from '../helpers'

export class $ implements Command {
  public static new(commands: Commands): $ {
    return new $(commands)
  }

  private constructor(private readonly commands: Commands) {}

  public async parse(argv: string[]) {
    const isHasEarlyAccessFeatureFlag = Boolean(argv.find((_) => _.match(/early-access-feature/)))
    if (!isHasEarlyAccessFeatureFlag) throw new EarlyAccessFlagError()
    const args = arg(argv, {})
    if (isError(args)) return args
    const result = await dispatchToSubCommand(this.commands, args)
    return JSON.stringify(result)
  }
}
