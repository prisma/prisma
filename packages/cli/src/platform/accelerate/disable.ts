import { Command } from '@prisma/internals'

export class Disable implements Command {
  public static new(): Disable {
    return new Disable()
  }

  public async parse(argv: string[]) {
    await Promise.resolve('todo')
    return JSON.stringify(argv)
  }
}
