import { Command, Commands } from '@prisma/internals'
import { underline } from 'kleur/colors'

import { EarlyAccessFlagError } from '../utils/errors'
import { createHelp, dispatchToSubCommand } from '../utils/platform'

export class $ implements Command {
  public static new(commands: Commands): $ {
    return new $(commands)
  }

  private constructor(private readonly commands: Commands) {}

  public help = createHelp({
    subcommands: [
      ['login', 'Logs into your Prisma Data Platform account or creates a new one with GitHub authentication'],
      ['logout', 'Logs out of your Prisma Data Platform account'],
      ['workspace', 'Manage workspaces'],
      ['project', 'Manage projects'],
      ['apikey', 'Manage API keys'],
      ['accelerate', 'Manage Accelerate feature'],
    ],
    options: [
      ['--early-access', '', 'Enable early access features'],
      ['--token', '', 'Specify a token to use for authentication'],
    ],
    examples: ['prisma platform login', 'prisma platform project create --workspace=<id>'],
    additionalContent: [
      'For detailed command descriptions and options, use `prisma platform [command] --help`',
      `For additional help or feedback, visit [support link or ${underline('https://pris.ly/todo')}`,
    ],
  })

  public async parse(argv: string[]) {
    const isHasEarlyAccessFeatureFlag = Boolean(argv.find((_) => _.match(/early-access/)))
    if (!isHasEarlyAccessFeatureFlag) throw new EarlyAccessFlagError()

    // Since `dispatchToSubCommand`
    // assumes that the first element of the array to be the command
    // we must remove the flag before
    //
    // It makes it possible to run, for example:
    // prisma platform --early-access login
    // prisma platform login --early-access
    const argvWithoutEarlyAccess = (argv = argv.filter((it) => it !== '--early-access'))

    // display help for help flag or no subcommand
    if (argv.length === 0 || ['-h', '--help'].includes(argvWithoutEarlyAccess[0])) {
      return this.help()
    }

    const result = await dispatchToSubCommand(this.commands, argvWithoutEarlyAccess)

    return result
  }
}
