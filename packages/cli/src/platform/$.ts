import { Command, Commands } from '@prisma/internals'

import { EarlyAccessFlagError } from '../../../migrate/src/utils/flagErrors'
import { dispatchToSubCommand } from '../utils/platform'

export const parseTokenArgument = (argv: string[]) => {
  const tokenIndex = argv.findIndex((arg) => ['--token', '-t'].includes(arg))
  if (tokenIndex === -1) {
    const value = process.env['PRISMA_TOKEN']
    if (value) {
      return value
    }
    return null
  }
  return argv[tokenIndex + 1]
}
export class $ implements Command {
  public static new(commands: Commands): $ {
    return new $(commands)
  }

  public constructor(private readonly commands: Commands) {}

  public async parse(argv: string[]) {
    const isHasEarlyAccessFeatureFlag = Boolean(argv.find((_) => _.match(/early-access-feature/)))
    if (!isHasEarlyAccessFeatureFlag) throw new EarlyAccessFlagError()

    const result = await dispatchToSubCommand(this.commands, argv)
    // TODO: Consider removing JSON.stringify as it breaks if sub-command parse returns JSON.stringify
    return JSON.stringify(result)
  }
}
