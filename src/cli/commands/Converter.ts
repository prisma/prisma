import { Command, arg, isError, format, Env, HelpError } from '@prisma/cli'
import chalk from 'chalk'
import { LiftEngine } from '../../LiftEngine'
import { DefaultParser, DatabaseType, isdlToDmmfDatamodel } from 'prisma-datamodel'
import { isdlToDatamodel2 } from '../../utils/isdlToDatamodel2'

export class Converter implements Command {
  static new(env: Env): Converter {
    return new Converter(env)
  }
  private constructor(private readonly env: Env) {}

  // parse arguments
  async parse(argv: string[]): Promise<string | Error> {
    // parse the arguments according to the spec
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
    })

    if (isError(args)) {
      return this.help(args.message)
    } else if (args['--help']) {
      return this.help()
    }

    const datamodel = await this.readStdin()
    const engine = new LiftEngine({ projectDir: process.cwd() })
    const parser = DefaultParser.create(DatabaseType.postgres)
    const isdl = parser.parseFromSchemaString(datamodel)
    return isdlToDatamodel2(isdl, [])
  }

  readStdin(): Promise<string> {
    return new Promise(resolve => {
      let input = ''

      process.stdin.on('data', data => {
        input += data.toString()
      })
      process.stdin.once('end', () => {
        resolve(input)
      })
      process.stdin.setEncoding('utf-8')
      process.stdin.resume()
    })
  }

  // help message
  help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${Converter.help}`)
    }
    return Converter.help
  }

  // static help template
  private static help = format(`
    Convert a datamodel 1.1 to datamodel 2

    ${chalk.bold('Usage')}

      prisma2 convert

    ${chalk.bold('Options')}

      -h, --help       Displays this help message

    ${chalk.bold('Examples')}

      ${chalk.dim(`$`)} cat old-datamodel.prisma | prisma2 convert > new-datamodel.prisma
  `)
}
