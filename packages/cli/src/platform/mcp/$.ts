import type { PrismaConfigInternal } from '@prisma/config'
import { Command, link } from '@prisma/internals'

import { createHelp } from '../_lib/help'

export class Mcp implements Command {
  public static new(): Mcp {
    return new Mcp()
  }

  private constructor() {}

  public help = createHelp({
    options: [
      ['--early-access', '', 'Enable early access features'],
      ['--token', '', 'Specify a token to use for authentication'],
    ],
    examples: ['prisma platform mcp --early-access'],
    additionalContent: [
      'Starts an MCP server to use with AI development tools such as Cursor, Windsurf and Claude Desktop',
      `For additional help visit ${link('https://pris.ly/cli/mcp')}`,
    ],
  })

  public async parse(_argv: string[], _config: PrismaConfigInternal): Promise<string | Error> {

    const result = await Promise.resolve("Starting MCP Server ...")

    return result
  }
}
