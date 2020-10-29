import chalk from 'chalk'
import {
  Command,
  Commands,
  arg,
  isError,
  format,
  HelpError,
  unknownCommand,
} from '@prisma/sdk'
import { Version } from './Version'
import { download } from '@prisma/fetch-engine'
import { link } from '@prisma/sdk'
import { enginesVersion } from '@prisma/engines'
const pkg = require('../package.json') // eslint-disable-line @typescript-eslint/no-var-requires

/**
 * CLI command
 */
export class CLI implements Command {
  static new(cmds: Commands, ensureBinaries: string[]): CLI {
    return new CLI(cmds, ensureBinaries)
  }
  private constructor(
    private readonly cmds: Commands,
    private readonly ensureBinaries: string[],
  ) {}

  async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--version': Boolean,
      '-v': '--version',
      '--json': Boolean, // for -v
      '--experimental': Boolean,
      '--early-access-feature': Boolean,
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--version']) {
      await this.downloadBinaries()
      return Version.new().parse(argv)
    }

    // display help for help flag or no subcommand
    if (args._.length === 0 || args['--help']) {
      if (args['--experimental']) {
        return CLI.experimentalHelp
      }
      return CLI.help
    }

    // check if we have that subcommand
    const cmdName = args._[0]
    if (cmdName === 'lift') {
      throw new Error(
        `${chalk.red('prisma lift')} has been renamed to ${chalk.green(
          'prisma migrate',
        )}`,
      )
    }
    const cmd = this.cmds[cmdName]
    if (cmd) {
      // if we have that subcommand, let's ensure that the binary is there in case the command needs it
      if (this.ensureBinaries.includes(cmdName)) {
        await this.downloadBinaries()
      }

      let argsForCmd: string[]
      if (args['--experimental']) {
        argsForCmd = [
          ...args._.slice(1),
          `--experimental=${args['--experimental']}`,
        ]
      } else if (args['--preview-feature']) {
        argsForCmd = argsForCmd = [
          ...args._.slice(1),
          `--preview-feature=${args['--preview-feature']}`,
        ]
      } else if (args['--early-access-feature']) {
        argsForCmd = argsForCmd = [
          ...args._.slice(1),
          `--early-access-feature=${args['--early-access-feature']}`,
        ]
      } else {
        argsForCmd = args._.slice(1)
      }

      return cmd.parse(argsForCmd)
    }
    // unknown command
    return unknownCommand(CLI.help, args._[0])
  }

  private async downloadBinaries(): Promise<void> {
    const binaryPath = eval(`require('path').join(__dirname, '../')`)
    const version = enginesVersion
    await download({
      binaries: {
        'query-engine': binaryPath,
        'migration-engine': binaryPath,
        'introspection-engine': binaryPath,
        'prisma-fmt': binaryPath,
      },
      showProgress: true,
      version,
      failSilent: false,
    })
  }

  private help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${CLI.help}`)
    }
    return CLI.help
  }

  private static help = format(`
    ${
      process.platform === 'win32' ? '' : chalk.bold.green('◭  ')
    }Prisma is a modern DB toolkit to query, migrate and model your database (${link(
    'https://prisma.io',
  )})

    ${chalk.bold('Usage')}

      ${chalk.dim('$')} prisma [command]

    ${chalk.bold('Commands')}

                init   Setup Prisma for your app
          introspect   Get the datamodel of your database
            generate   Generate artifacts (e.g. Prisma Client)
              studio   Open Prisma Studio
              format   Format your schema
                  db   Manage your database schema and lifecycle ${chalk.dim(
                    '(Preview)',
                  )}

    ${chalk.bold('Flags')}

            --experimental   Show and run Experimental Prisma commands
         --preview-feature   Run Preview Prisma commands
    --early-access-feature   Run Early Access Prisma commands

    ${chalk.bold('Examples')}

      Setup a new Prisma project
      ${chalk.dim('$')} prisma init

      Introspect an existing database
      ${chalk.dim('$')} prisma introspect

      Generate artifacts (e.g. Prisma Client)
      ${chalk.dim('$')} prisma generate

      Browse your data
      ${chalk.dim('$')} prisma studio

      Push the Prisma schema state to the database
      ${chalk.dim('$')} prisma db push --preview-feature
  `)

  private static experimentalHelp = format(`
    ${
      process.platform === 'win32' ? '' : chalk.bold.green('◭  ')
    }Prisma is a modern DB toolkit to query, migrate and model your database (${link(
    'https://prisma.io',
  )})

    ${chalk.bold('Usage')}

      ${chalk.dim('$')} prisma [command]

    ${chalk.bold('Commands')}

                init   Setup Prisma for your app
          introspect   Get the datamodel of your database
            generate   Generate artifacts (e.g. Prisma Client)
              studio   Open Prisma Studio
              format   Format your schema
                  db   Manage your database schema and lifecycle ${chalk.dim(
                    '(Preview)',
                  )}
             migrate   Migrate your schema ${chalk.dim('(Early Access)')}

    ${chalk.bold('Flags')}

            --experimental   Show and run Experimental Prisma commands
         --preview-feature   Run Preview Prisma commands
    --early-access-feature   Run Early Access Prisma commands
    
    ${chalk.bold('Examples')}

      Setup a new Prisma project
      ${chalk.dim('$')} prisma init

      Introspect an existing database
      ${chalk.dim('$')} prisma introspect

      Generate artifacts (e.g. Prisma Client)
      ${chalk.dim('$')} prisma generate
      
      Browse your data
      ${chalk.dim('$')} prisma studio

      Push the Prisma schema state to the database
      ${chalk.dim('$')} prisma db push --preview-feature

      Create a migration for your database
      ${chalk.dim('$')} prisma migrate save --early-access-feature
  `)
}
