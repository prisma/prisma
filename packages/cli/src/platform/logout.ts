import { Command } from '@prisma/internals'

export class Logout implements Command {
  public static new(): Logout {
    return new Logout()
  }

  public async parse(argv: string[]) {
    await Promise.resolve('todo')
    return JSON.stringify(argv)
  }
}
