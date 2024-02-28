import { deserializeErrorMessage } from '@prisma/client/internal'
import type { Command } from '@prisma/internals'
import { arg, format, HelpError, isError } from '@prisma/internals'
import { bold, dim, red } from 'kleur/colors'

const packageJson = require('../package.json')

/**
 * $ prisma debug
 */
export class DecodeError implements Command {
  static new(): DecodeError {
    return new DecodeError()
  }

  private static help = format(`
  Decodes an error message from Prisma Client

  ${bold('Usage')}

    ${dim('$')} prisma decode-error <base64-encoded-error>

  ${bold('Options')}

    -h, --help     Display this help message
`)

  // eslint-disable-next-line @typescript-eslint/require-await
  async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    return deserializeErrorMessage(args._[0], packageJson.version)
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${DecodeError.help}`)
    }

    return DecodeError.help
  }
}
