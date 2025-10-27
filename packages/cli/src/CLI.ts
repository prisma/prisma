import type { PrismaConfigInternal } from '@prisma/config'
import { Debug } from '@prisma/debug'
import { ensureNeededBinariesExist } from '@prisma/engines'
import type { BinaryPaths, DownloadOptions } from '@prisma/fetch-engine'
import type { Command, Commands } from '@prisma/internals'
import { arg, drawBox, format, HelpError, isError, link, unknownCommand } from '@prisma/internals'
import { bold, dim, green, red } from 'kleur/colors'

import { runCheckpointClientCheck } from './utils/checkpoint'
import { getClientGeneratorInfo } from './utils/client'
import { printUpdateMessage } from './utils/printUpdateMessage'
import { Version } from './Version'

const debug = Debug('prisma:cli')

/**
 * CLI command
 */
export class CLI implements Command {
  static new(
    cmds: Commands,
    ensureBinaries: string[],
    download: (options: DownloadOptions) => Promise<BinaryPaths>,
  ): CLI {
    return new CLI(cmds, ensureBinaries, download)
  }

  private constructor(
    private readonly cmds: Commands,
    private readonly ensureBinaries: string[],
    private readonly download: (options: DownloadOptions) => Promise<BinaryPaths>,
  ) {}

  async parse(argv: string[], config: PrismaConfigInternal): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--version': Boolean,
      '-v': '--version',
      '--config': String,
      '--json': Boolean, // for -v
      '--experimental': Boolean,
      '--preview-feature': Boolean,
      '--early-access': Boolean,
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    // display help for help flag or no subcommand
    if (!args['--version'] && (args._.length === 0 || args['--help'])) {
      return this.help()
    }

    const hasMigrateAdapterInConfig = config.engine === 'js'

    // We pre-parse the optional custom schema path from `prisma [cmd] --schema ...`,
    // which we use to inspect the client generator to determine whether we should
    // download the Prisma binaries or not.
    // Note: a probably cleaner way of doing this would be to:
    // - change the `Command` interface so that `parse` merely parses the CLI arguments,
    //   returning a `RunnableCommand` instance, which can then be executed via `.run()`.
    // - call `this.cmds[cmdName].parse(...)` and access the parse `--schema` argument.
    const cmdArgs = arg(args._.slice(1), {
      '--schema': String,
    })
    const schemaPathFromArg = isError(cmdArgs) ? undefined : cmdArgs['--schema']

    // Extract client generator info once, use it for either `prisma --version`, or
    // for any other supported command. If no client generator is successfully found,
    // use sensible default values.
    const { engineType } = await getClientGeneratorInfo({
      schemaPathFromConfig: config.schema,
      schemaPathFromArg,
    }).catch((e) => {
      debug('Failed to read schema information. Using default values: %o', e)

      return { engineType: 'library' as const }
    })

    if (args['--version']) {
      await ensureNeededBinariesExist({
        clientEngineType: engineType,
        download: this.download,
        hasMigrateAdapterInConfig,
      })
      return Version.new().parse(argv, config)
    }

    // check if we have that subcommand
    const cmdName = args._[0]
    // Throw if "lift"
    if (cmdName === 'lift') {
      throw new Error(`${red('prisma lift')} has been renamed to ${green('prisma migrate')}`)
    }

    const cmd = this.cmds[cmdName]
    if (cmd) {
      // Only track if the command actually exists
      const checkResultPromise = runCheckpointClientCheck({ schemaPathFromConfig: config.schema }).catch(() => {
        /* noop */
      })

      // if we have that subcommand, let's ensure that the binary is there in case the command needs it
      if (this.ensureBinaries.includes(cmdName)) {
        await ensureNeededBinariesExist({
          clientEngineType: engineType,
          download: this.download,
          hasMigrateAdapterInConfig,
        })
      }

      let argsForCmd: string[]
      if (args['--experimental']) {
        argsForCmd = [...args._.slice(1), `--experimental=${args['--experimental']}`]
      } else if (args['--preview-feature']) {
        argsForCmd = [...args._.slice(1), `--preview-feature=${args['--preview-feature']}`]
      } else if (args['--early-access']) {
        argsForCmd = [...args._.slice(1), `--early-access=${args['--early-access']}`]
      } else {
        argsForCmd = args._.slice(1)
      }

      const result = await cmd.parse(argsForCmd, config)

      printUpdateMessage(await checkResultPromise)

      return result
    }
    // unknown command
    return unknownCommand(this.help() as string, args._[0])
  }

  public help(error?: string) {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${CLI.help}`)
    }
    return CLI.help
  }

  private static tryPdpMessage = `Optimize performance through connection pooling and caching with Prisma Accelerate
and capture real-time events from your database with Prisma Pulse.
Learn more at ${link('https://pris.ly/cli/pdp')}`

  private static boxedTryPdpMessage = drawBox({
    height: this.tryPdpMessage.split('\n').length,
    width: 0, // calculated automatically
    str: this.tryPdpMessage,
    horizontalPadding: 2,
  })

  private static help = format(`
    ${
      process.platform === 'win32' ? '' : bold(green('◭  '))
    }Prisma is a modern DB toolkit to query, migrate and model your database (${link('https://prisma.io')})

    ${bold('Usage')}

      ${dim('$')} prisma [command]

    ${bold('Commands')}

                init   Set up Prisma for your app
                 dev   Start a local Prisma Postgres server for development
            generate   Generate artifacts (e.g. Prisma Client)
                  db   Manage your database schema and lifecycle
             migrate   Migrate your database
              studio   Browse your data with Prisma Studio
            validate   Validate your Prisma schema
              format   Format your Prisma schema
             version   Displays Prisma version info
               debug   Displays Prisma debug info
                 mcp   Starts an MCP server to use with AI development tools

    ${bold('Flags')}

         --preview-feature   Run Preview Prisma commands
         --help, -h          Show additional information about a command

${this.boxedTryPdpMessage}

    ${bold('Examples')}

      Set up a new local Prisma Postgres \`prisma dev\`-ready project
      ${dim('$')} prisma init

      Start a local Prisma Postgres server for development
      ${dim('$')} prisma dev

      Generate artifacts (e.g. Prisma Client)
      ${dim('$')} prisma generate

      Browse your data
      ${dim('$')} prisma studio

      Create migrations from your Prisma schema, apply them to the database, generate artifacts (e.g. Prisma Client)
      ${dim('$')} prisma migrate dev

      Pull the schema from an existing database, updating the Prisma schema
      ${dim('$')} prisma db pull

      Push the Prisma schema state to the database
      ${dim('$')} prisma db push

      Validate your Prisma schema
      ${dim('$')} prisma validate

      Format your Prisma schema
      ${dim('$')} prisma format

      Display Prisma version info
      ${dim('$')} prisma version

      Display Prisma debug info
      ${dim('$')} prisma debug
  `)
}
