import { ensureBinariesExist } from '@prisma/engines'
import type { Command, Commands } from '@prisma/internals'
import { arg, format, HelpError, isError, link, logger, unknownCommand } from '@prisma/internals'
import chalk from 'chalk'

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
      throw new Error(`${chalk.red('prisma lift')} has been renamed to ${chalk.green('prisma migrate')}`)
    }
    // warn if "introspect"
    else if (cmdName === 'introspect') {
      logger.warn('')
      logger.warn(
        `${chalk.bold(
          `The ${chalk.underline('prisma introspect')} command is deprecated. Please use ${chalk.green(
            'prisma db pull',
          )} instead.`,
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
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${CLI.help}`)
    }
    return CLI.help
  }

  private static help = format(`
    ${
      process.platform === 'win32' ? '' : chalk.bold.green('◭  ')
    }Prisma is a modern DB toolkit to query, migrate and model your database (${link('https://prisma.io')})

    ${chalk.bold('Usage')}

      ${chalk.dim('$')} prisma [command]

    ${chalk.bold('Commands')}

                init   Set up Prisma for your app
            generate   Generate artifacts (e.g. Prisma Client)
                  db   Manage your database schema and lifecycle
             migrate   Migrate your database
              studio   Browse your data with Prisma Studio
              format   Format your schema

    ${chalk.bold('Flags')}

         --preview-feature   Run Preview Prisma commands

    ${chalk.bold('Examples')}

      Set up a new Prisma project
      ${chalk.dim('$')} prisma init

      Generate artifacts (e.g. Prisma Client)
      ${chalk.dim('$')} prisma generate

      Browse your data
      ${chalk.dim('$')} prisma studio

      Create migrations from your Prisma schema, apply them to the database, generate artifacts (e.g. Prisma Client)
      ${chalk.dim('$')} prisma migrate dev
  
      Pull the schema from an existing database, updating the Prisma schema
      ${chalk.dim('$')} prisma db pull

      Push the Prisma schema state to the database
      ${chalk.dim('$')} prisma db push
  `)
}
