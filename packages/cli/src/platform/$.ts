import { Command, Commands } from '@prisma/internals'

import { EarlyAccessFlagError } from '../../../migrate/src/utils/flagErrors'
import { dispatchToSubCommand } from '../utils/platform'

export class $ implements Command {
  public static new(commands: Commands): $ {
    return new $(commands)
  }

  private constructor(private readonly commands: Commands) {}

  public async parse(argv: string[]) {
    const isHasEarlyAccessFeatureFlag = Boolean(argv.find((_) => _.match(/early-access-feature/)))
    if (!isHasEarlyAccessFeatureFlag) throw new EarlyAccessFlagError()
    const result = await dispatchToSubCommand(this.commands, argv)
    // TODO: Consider removing JSON.stringify as it breaks if sub-command parse returns JSON.stringify
    return JSON.stringify(result)
  }
}
