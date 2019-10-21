import { arg, Command, Dictionary, format, HelpError, isError } from '@prisma/cli'
import chalk from 'chalk'

import { Studio } from '../../Studio'

export class StudioCommand implements Command {
  public static new(providerAliases: Dictionary<string>): StudioCommand {
    return new StudioCommand(providerAliases)
  }

  private static help = format(`
    Browse your data with Studio

    ${chalk.bold('Usage')}

      prisma studio

    ${chalk.bold('Options')}

      -h, --help     Displays this help message
      -p, --port     Port to start Studio on

    ${chalk.bold('Examples')}

      Start Studio on the default port
      ${chalk.dim(`$`)} prisma studio

      Start Studio on a custom port
      ${chalk.dim(`$`)} prisma studio --port 5555
  `)

  private constructor(private readonly providerAliases: Dictionary<string>) {
    this.providerAliases = providerAliases
  }

  /**
   * Parses arguments passed to this command
   *
   * @param argv Array of all arguments
   */
  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--port': Number,
      '-p': '--port',
    })

    if (isError(args)) {
      return this.help(args.message)
    } else if (args['--help']) {
      return this.help()
    }

    const studio = new Studio({
      port: args['--port'],
    })

    return await studio.start(this.providerAliases)
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${StudioCommand.help}`)
    }

    return StudioCommand.help
  }
}
