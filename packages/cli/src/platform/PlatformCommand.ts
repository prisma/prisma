import { Command } from '@prisma/internals'

import { EarlyAccessFlagError } from '../../../migrate/src/utils/flagErrors'

export class PlatformCommand implements Command {
  public static new(): PlatformCommand {
    return new PlatformCommand()
  }

  public async parse(argv: string[]) {
    const isHasEarlyAccessFeatureFlag = Boolean(argv.find((_) => _.match(/early-access-feature/)))
    if (!isHasEarlyAccessFeatureFlag) throw new EarlyAccessFlagError() // prettier-ignore

    // todo Molt Command does not support CJS
    // import { Command as MoltCommand } from '@molt/command'
    // const args = MoltCommand.create().parse({ line: argv })
    // console.log(args)
    // console.log({ argv })

    await Promise.resolve('todo')

    return '' // satisfy Command Class
  }
}
