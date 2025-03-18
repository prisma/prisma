import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { PrismaConfigInternal } from '@prisma/config'
import { Command, link } from '@prisma/internals'
import { spawn } from 'child_process'
import { z } from 'zod'

import { createHelp } from '../_lib/help'

function spawnAsPromise(command: string, args: string[] = []): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args)

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data
    })

    child.stderr.on('data', (data) => {
      stderr += data
    })
    child.on('close', () => {
      resolve({ stdout, stderr })
    })

    child.on('error', (err) => {
      resolve({ stdout: '', stderr: err.message })
    })
  })
}

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

    server.tool(
      'migrate-status',
      `The prisma migrate status command looks up the migrations in ./prisma/migrations/* folder and the entries in the _prisma_migrations table and compiles information about the state of the migrations in your database.
            Example output:

            Status
            3 migrations found in prisma/migrations

            Your local migration history and the migrations table from your database are different:

            The last common migration is: 20201127134938_new_migration

            The migration have not yet been applied:
            20201208100950_test_migration

            The migrations from the database are not found locally in prisma/migrations:
            20201208100950_new_migration`,
      async () => {
        const res = await spawnAsPromise('npx', ['prisma', 'migrate', 'status'])

        return { content: [{ type: 'text', text: res.stdout + '\n' + res.stderr }] }
      },
    )

    server.tool(
      'migrate-dev',
      `Prisma Migrate Dev is used to update Prisma whenever the schema.prisma file has been modified. Always provide a descriptive name argument describing the change that was made to the Prisma Schema.

            The migrate dev command performs these steps:

            1. Reruns the existing migration history in the shadow database in order to detect schema drift (edited or deleted migration file, or a manual changes to the database schema)
            2. Applies pending migrations to the shadow database (for example, new migrations created by colleagues)
            3. Generates a new migration from any changes you made to the Prisma schema before running migrate dev
            4. Applies all unapplied migrations to the development database and updates the _prisma_migrations table
            5. Triggers the generation of artifacts (for example, Prisma Client)`,
      { name: z.string() },
      async ({ name }) => {
        const res = await spawnAsPromise('npx', ['prisma', 'migrate', 'dev', '--name', name])

        return { content: [{ type: 'text', text: res.stdout + '\n' + res.stderr }] }
      },
    )

    server.tool(
      'migrate-reset',
      `Prisma Migrate Reset --force is used to reset the database and migration history if drift is detected. Only run this command on a development database - never on production databases! If in doubt, ask the user to confirm.
    
                The migrate reset command performs these steps:
    
                1. Drops the database/schema if possible, or performs a soft reset if the environment does not allow deleting databases/schemas
                2. Creates a new database/schema with the same name if the database/schema was dropped
                3. Applies all migrations
                4. Runs seed scripts`,
      async () => {
        const res = await spawnAsPromise('npx', ['prisma', 'migrate', 'reset', '--force'])

        return { content: [{ type: 'text', text: res.stdout + '\n' + res.stderr }] }
      },
    )

    const transport = new StdioServerTransport()
    await server.connect(transport)

    return ''
  }
}
