import { arg, Command, Commands, isError } from '@prisma/internals'

import { dispatchToSubCommand } from '../../helpers'

export class $ implements Command {
  public static new(commands: Commands): $ {
    return new $(commands)
  }

  private constructor(private readonly commands: Commands) {}

  public async parse(argv: string[]) {
    const args = arg(argv, {})
    if (isError(args)) return args
    return dispatchToSubCommand(this.commands, args)
  }
}
