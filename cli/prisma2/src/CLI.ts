import chalk from 'chalk'
import { Command, Commands, arg, isError, format, HelpError, unknownCommand } from '@prisma/cli'
import { Version } from './Version'
import { download } from '@prisma/fetch-engine'
import { link } from '@prisma/sdk'
const pkg = require('../package.json')

/**
 * CLI command
 */
export class CLI implements Command {
  static new(cmds: Commands, ensureBinaries: string[]): CLI {
    return new CLI(cmds, ensureBinaries)
  }
  private constructor(private readonly cmds: Commands, private readonly ensureBinaries: string[]) {}

  async parse(argv: string[]): Promise<string | Error> {
    // parse the args according to the following spec
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--version': Boolean,
      '-v': '--version',
      '--experimental': Boolean,
    })
    if (isError(args)) {
      return this.help(args.message)
    }
    if (args['--version']) {
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
      throw new Error(`${chalk.red('prisma2 lift')} has been renamed to ${chalk.green('prisma2 migrate')}`)
    }
    const cmd = this.cmds[cmdName]
    if (cmd) {
      // if we have that subcommand, let's ensure that the binary is there in case the command needs it
      if (this.ensureBinaries.includes(cmdName)) {
        const binaryPath = eval(`require('path').join(__dirname, '../')`)
        const version = (pkg && pkg.prisma && pkg.prisma.version) || 'latest'
        await download({
          binaries: {
            'query-engine': binaryPath,
            'migration-engine': binaryPath,
            'introspection-engine': binaryPath,
          },
          showProgress: true,
          version,
          failSilent: false,
        })
      }

      return cmd.parse(args._.slice(1))
    }
    // unknown command
    return unknownCommand(CLI.help, args._[0])
  }

  // help function
  private help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${CLI.help}`)
    }
    return CLI.help
  }

  // static help template
  private static help = format(`
    ${chalk.bold.green('◭')} Prisma is a modern DB toolkit to query, migrate and model your database (${link('https://prisma.io')})

    ${chalk.bold('Usage')}

      ${chalk.dim(`$`)} prisma2 [command]

    ${chalk.bold('Commands')}

                init   Setup Prisma for your app
          introspect   Get the datamodel of your database
            generate   Generate Prisma Client

    ${chalk.bold('Flags')}

      --experimental   Show and run experimental Prisma commands

    ${chalk.bold('Examples')}

      Setup Prisma for your existing database
      ${chalk.dim(`$`)} prisma2 init

      Introspect an existing database
      ${chalk.dim(`$`)} prisma2 introspect

      Generate Prisma Client
      ${chalk.dim(`$`)} prisma2 generate
  `)

  // static help template
  private static experimentalHelp = format(`
    ${chalk.bold.green('◭')} Prisma is a modern DB toolkit to query, migrate and model your database (${link('https://prisma.io')})

    ${chalk.bold('Usage')}

      ${chalk.dim(`$`)} prisma2 [command]

    ${chalk.bold('Commands')}

                init   Setup Prisma for your app
          introspect   Get the datamodel of your database
            generate   Generate Prisma Client
             migrate   Migrate your schema ${chalk.dim('(experimental)')}
              studio   Run Prisma Studio ${chalk.dim('(experimental)')}

    ${chalk.bold('Flags')}

      --experimental   Show and run experimental Prisma commands

    ${chalk.bold('Examples')}

      Initialize files for a new Prisma project
      ${chalk.dim(`$`)} prisma2 init

      Introspect an existing database
      ${chalk.dim(`$`)} prisma2 introspect

      Generate Prisma Client
      ${chalk.dim(`$`)} prisma2 generate

      Save your changes into a migration
      ${chalk.dim(`$`)} prisma2 migrate save --experimental
  `)
}
