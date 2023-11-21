import { Command } from '@prisma/internals'

export class Login implements Command {
  public static new(): Login {
    return new Login()
  }

  public async parse(argv: string[]) {
    await Promise.resolve('todo')
    return JSON.stringify(argv)
  }
}
