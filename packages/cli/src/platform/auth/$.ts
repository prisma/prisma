import { Command, Commands } from '@prisma/internals'

export class $ implements Command {
  public static new(commands: Commands): $ {
    return new $(commands)
  }

  private constructor(private readonly commands: Commands) {}

  public async parse(argv: string[]) {
    console.log(`haloo`)
    await Promise.resolve('todo')

    return JSON.stringify(argv)
  }
}
