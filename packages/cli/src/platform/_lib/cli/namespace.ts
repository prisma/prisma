import { Command, Commands } from '@prisma/internals'

import { dispatchToSubCommand } from './dispatchToSubCommand'

export const createNamespace = () => {
  return class $ implements Command {
    public static new(commands: Commands): $ {
      return new $(commands)
    }
    private constructor(public readonly commands: Commands) {}

    public async parse(argv: string[]) {
      return await dispatchToSubCommand(this.commands, argv)
    }
  }
}
