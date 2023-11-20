// import { Command as MoltCommand } from '@molt/command'
import { Command, unknownCommand } from '@prisma/internals'

export class PlatformCommand implements Command {
  public static new(): PlatformCommand {
    return new PlatformCommand()
  }

  public async parse(argv: string[]) {
    const isHasEarlyAccessFeatureFlag = Boolean(argv.find((_) => _.match(/early-access-feature/)))
    if (!isHasEarlyAccessFeatureFlag) return unknownCommand('You must pass --early-access-feature to use platform commands.', 'platform') // prettier-ignore

    // todo Molt Command does not support CJS
    // const args = MoltCommand.create().parse({ line: argv })
    // console.log(args)
    console.log({ argv })

    await Promise.resolve('todo')

    return '' // satisfy Command Class
  }
}
