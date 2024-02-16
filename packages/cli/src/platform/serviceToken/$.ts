import { Command, Commands } from '@prisma/internals'

import { dispatchToSubCommand } from '../_lib/utils'

export class $ implements Command {
  public static new(commands: Commands, legacy: boolean = false): $ {
    return new $(commands, legacy)
  }

  private constructor(private readonly commands: Commands, private readonly legacy: boolean = false) {}

  public async parse(argv: string[]) {
    return dispatchToSubCommand(this.commands, argv)
  }
}
