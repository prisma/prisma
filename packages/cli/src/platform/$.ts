import type { PrismaConfigInternal } from '@prisma/config'
import type { Command, Commands } from '@prisma/internals'
import { arg, HelpError, isError } from '@prisma/internals'
import { bold, red } from 'kleur/colors'

import { dispatchToSubCommand } from './_lib/cli/dispatchToSubCommand'
import { createHelp } from './_lib/help'

/** $ prisma platform */
export class $ implements Command {
  static new(cmds: Commands): $ {
    return new $(cmds)
  }

  private constructor(private readonly cmds: Commands) {}

  async parse(argv: string[], config: PrismaConfigInternal, baseDir: string = process.cwd()): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args._.length === 0 || args['--help']) {
      return this.help()
    }

    const result = await dispatchToSubCommand(this.cmds, args._, config, baseDir)
    if (result instanceof Error) {
      return this.help(result.message)
    }
    return result
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${$.help}`)
    }
    return $.help
  }

  private static help = createHelp({
    subcommands: [['status', 'Show Prisma Data Platform service status']],
    examples: ['prisma platform status'],
  })
}
