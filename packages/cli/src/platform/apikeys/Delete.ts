import { Command } from '@prisma/internals'

export class Delete implements Command {
  public static new(): Delete {
    return new Delete()
  }

  public async parse(argv: string[]) {
    await Promise.resolve('todo')
    return JSON.stringify(argv)
  }
}
