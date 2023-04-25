import { ensureBinariesExist } from '@prisma/engines'
import type { Command, Commands } from '@prisma/internals'
import { arg, format, HelpError, isError, link, logger, unknownCommand } from '@prisma/internals'
import { bold, dim, green, red, underline } from 'kleur/colors'

import { Version } from './Version'

/**
 * CLI command
 */
export class CLI implements Command {
  static new(cmds: Commands, ensureBinaries: string[]): CLI {
    return new CLI(cmds, ensureBinaries)
  }
  private constructor(private readonly cmds: Commands, private readonly ensureBinaries: string[]) {}

  async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--version': Boolean,
      '-v': '--version',
      '--json': Boolean, // for -v
      '--experimental': Boolean,
      '--preview-feature': Boolean,
      '--early-access-feature': Boolean,
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--version']) {
      await ensureBinariesExist()
      return Version.new().parse(argv)
    }

    // display help for help flag or no subcommand
    if (args._.length === 0 || args['--help']) {
      return this.help()
    }

    // check if we have that subcommand
    const cmdName = args._[0]
    // Throw if "lift"
    if (cmdName === 'lift') {
      throw new Error(`${red('prisma lift')} has been renamed to ${green('prisma migrate')}`)
    }
    // warn if "introspect"
    else if (cmdName === 'introspect') {
      logger.warn('')
      logger.warn(
        `${bold(
          `The ${underline('prisma introspect')} command is deprecated. Please use ${green('prisma db pull')} instead.`,
        )}`,
      )
      logger.warn('')
    }

    const cmd = this.cmds[cmdName]
    if (cmd) {
      // if we have that subcommand, let's ensure that the binary is there in case the command needs it
      if (this.ensureBinaries.includes(cmdName)) {
        await ensureBinariesExist()
      }

      let argsForCmd: string[]
      if (args['--experimental']) {
        argsForCmd = [...args._.slice(1), `--experimental=${args['--experimental']}`]
      } else if (args['--preview-feature']) {
        argsForCmd = [...args._.slice(1), `--preview-feature=${args['--preview-feature']}`]
      } else if (args['--early-access-feature']) {
        argsForCmd = [...args._.slice(1), `--early-access-feature=${args['--early-access-feature']}`]
      } else {
        argsForCmd = args._.slice(1)
      }

      return cmd.parse(argsForCmd)
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

  private static help = format(`
    ${
      process.platform === 'win32' ? '' : bold(green('◭  '))
    }Prisma is a modern DB toolkit to query, migrate and model your database (${link('https://prisma.io')})

    ${bold('Usage')}

      ${dim('$')} prisma [command]

    ${bold('Commands')}

                init   Set up Prisma for your app
            generate   Generate artifacts (e.g. Prisma Client)
                  db   Manage your database schema and lifecycle
             migrate   Migrate your database
              studio   Browse your data with Prisma Studio
            validate   Validate your Prisma schema
              format   Format your Prisma schema

    ${bold('Flags')}

         --preview-feature   Run Preview Prisma commands

    ${bold('Examples')}

      Set up a new Prisma project
      ${dim('$')} prisma init

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
  `)
}
