import chalk from 'chalk'
import { Command, format, HelpError } from '@prisma/cli'
import open from 'open'
import { link } from './link'

/**
 * $ prisma COMMAND_NAME docs
 */
export class Docs implements Command {
  public static new(commandName: string, url: string): Docs {
    return new Docs(commandName, url)
  }

  // static help template
  private static help = commandName =>
    format(`
    Opens the docs page for ${commandName}.
  `)
  private constructor(private readonly commandName: string, private readonly url: string) {}

  // parse arguments
  public async parse(argv: string[]): Promise<string | Error> {
    console.log(`Opening ${chalk.greenBright(this.commandName)} docs at ${link(this.url)}`)
    await open(this.url)
    return ''
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${Docs.help}`)
    }
    return Docs.help(this.commandName)
  }
}
