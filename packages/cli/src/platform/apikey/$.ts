import { Command, Commands } from '@prisma/internals'

import { dispatchToSubCommand } from '../../utils/platform'

export class $ implements Command {
  public static new(commands: Commands): $ {
    return new $(commands)
  }

  private constructor(private readonly commands: Commands) {}

  public async parse(argv: string[]) {
    return dispatchToSubCommand(this.commands, argv)
  }
}
