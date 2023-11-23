import { Command, Commands } from '@prisma/internals'

export class $ implements Command {
  public static new(commands: Commands): $ {
    return new $(commands)
  }

  private constructor(private readonly commands: Commands) {}

  public async parse(argv: string[]) {
    await Promise.resolve('todo')

    return JSON.stringify(argv)
  }
}
