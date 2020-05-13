import { arg, Command, format, HelpError, isError } from '@prisma/sdk'
import chalk from 'chalk'

import { Studio } from '../Studio'
import { ProviderAliases } from '@prisma/sdk'
import { ExperimentalFlagError } from '../utils/experimental'

export class StudioCommand implements Command {
  public static new(providerAliases: ProviderAliases): StudioCommand {
    return new StudioCommand(providerAliases)
  }

  private static help = format(`
    Browse your data with Studio

    ${chalk.bold.yellow('WARNING')} ${chalk.bold(
    "Prisma's studio functionality is currently in an experimental state.",
  )}
    ${chalk.dim(
      'When using any of the commands below you need to explicitly opt-in via the --experimental flag.',
    )}

    ${chalk.bold('Usage')}

      ${chalk.dim('$')} prisma studio --experimental

    ${chalk.bold('Options')}

      -h, --help        Displays this help message
      -p, --port        Port to start Studio on
      -b, --browser     Browser to open Studio in

    ${chalk.bold('Examples')}

      Start Studio on the default port
      ${chalk.dim('$')} prisma studio --experimental

      Start Studio on a custom port
      ${chalk.dim('$')} prisma studio --port 5555 --experimental

      Start Studio in a specific browser
      ${chalk.dim(
        '$',
      )} prisma studio --port 5555 --browser firefox --experimental
      ${chalk.dim('$')} BROWSER=firefox prisma studio --port 5555 --experimental

      Start Studio without opening in a browser
      ${chalk.dim('$')} prisma studio --port 5555 --browser none --experimental
      ${chalk.dim('$')} BROWSER=none prisma studio --port 5555 --experimental
  `)

  private constructor(private readonly providerAliases: ProviderAliases) {
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
      '--browser': String,
      '-b': '--browser',
      '--schema': String,
      '--experimental': Boolean,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    if (!args['--experimental']) {
      throw new ExperimentalFlagError()
    }

    const port = args['--port'] || 5555
    const browser = args['--browser'] || process.env.BROWSER

    const studio = new Studio({
      schemaPath: args['--schema'],
      browser,
      port,
    })

    return studio.start(this.providerAliases)
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${StudioCommand.help}`,
      )
    }

    return StudioCommand.help
  }
}
