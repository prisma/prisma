import { Command } from '@prisma/internals'

export class Show implements Command {
  public static new(): Show {
    return new Show()
  }

  public async parse(argv: string[]) {
    await Promise.resolve('todo')
    return JSON.stringify(argv)
  }
}
