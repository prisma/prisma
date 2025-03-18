import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { PrismaConfigInternal } from '@prisma/config'
import { Command, link } from '@prisma/internals'
import { z } from 'zod'

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
    const server = new McpServer({
      name: 'Prisma',
      version: '1.0.0',
    })

    // Add an addition tool
    server.tool('add', { a: z.number(), b: z.number() }, ({ a, b }) => ({
      content: [{ type: 'text', text: String(a + b) }],
    }))

    const transport = new StdioServerTransport()
    await server.connect(transport)

    return ''
  }
}
