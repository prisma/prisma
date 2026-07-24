import type { PrismaConfigInternal } from '@prisma/config'
import type { Command } from '@prisma/internals'
import { arg, format, HelpError, isError } from '@prisma/internals'
import { bold, dim, red } from 'kleur/colors'

import { fetchStatus } from './status-page'

/** $ prisma platform status */
export class Status implements Command {
  static new(): Status {
    return new Status()
  }

  private static help = format(`
  Show Prisma Data Platform service status

  ${bold('Usage')}

  ${dim('$')} prisma platform status [options]

  ${bold('Options')}

    -h, --help     Display this help message
        --json     Output raw JSON from the status API
`)

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${Status.help}`)
    }

    return Status.help
  }

  async parse(argv: string[], _config: PrismaConfigInternal): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--json': Boolean,
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    return fetchStatus(args['--json'] ?? false)
  }
}
