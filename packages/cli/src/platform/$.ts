import { Command, Commands, link } from '@prisma/internals'

import { EarlyAccessFlagError } from '../utils/errors'
import { dispatchToSubCommand } from './_lib/cli/dispatchToSubCommand'
import { createHelp } from './_lib/help'

export class $ implements Command {
  public static new(commands: Commands): $ {
    return new $(commands)
  }

  private constructor(private readonly commands: Commands) {}

  public help = createHelp({
    subcommands: [
      ['auth', 'Manage authentication with your Prisma Data Platform account'],
      ['workspace', 'Manage workspaces'],
      ['project', 'Manage projects'],
      ['environment', 'Manage environments'],
      // todo replace apikey with serviceToken
      ['apikey', 'Manage API keys'],
      // ['serviceToken', 'Manage service tokens'],
      ['accelerate', 'Manage Prisma Accelerate'],
      ['pulse', 'Manage Prisma Pulse'],
    ],
    options: [
      ['--early-access', '', 'Enable early access features'],
      ['--token', '', 'Specify a token to use for authentication'],
    ],
    examples: ['prisma platform auth login', 'prisma platform project create --workspace <id>'],
    additionalContent: [
      'For detailed command descriptions and options, use `prisma platform [command] --help`',
      `For additional help visit ${link('https://pris.ly/cli/platform-docs')}`,
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
    // prisma platform auth login --early-access
    const argvWithoutEarlyAccess = (argv = argv.filter((it) => it !== '--early-access'))

    // display help for help flag or no subcommand
    if (argv.length === 0 || ['-h', '--help'].includes(argvWithoutEarlyAccess[0])) {
      return this.help()
    }

    const result = await dispatchToSubCommand(this.commands, argvWithoutEarlyAccess)

    return result
  }
}
