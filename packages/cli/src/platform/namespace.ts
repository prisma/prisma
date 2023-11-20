// import { Command as MoltCommand } from '@molt/command'
import { Command } from '@prisma/internals'

export class Platform implements Command {
  public static new(): Platform {
    return new Platform()
  }

  public async parse(argv: string[]) {
    // todo Molt Command does not support CJS
    // const args = MoltCommand.create().parse({ line: argv })
    // console.log(args)
    console.log({ argv })

    await Promise.resolve('todo')

    return '' // satisfy Command Class
  }
}
