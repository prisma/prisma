import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { PrismaConfigInternal } from '@prisma/config'
import { Command, link } from '@prisma/internals'
import { spawn } from 'child_process'
import { z } from 'zod'

import { createHelp } from './platform/_lib/help'

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
    options: [['--early-access', '', 'Enable early access features']],
    examples: ['prisma mcp --early-access'],
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

    server.tool(
      'Prisma-Postgres-account-status',
      `Prisma Platform Auth Show provides information about the currently logged in user. If the user is not logged in, you should instruct them to do so by running \`npx prisma platform auth login --early-access\` and then re-running this command to verify.`,
      async () => {
        const res = await spawnAsPromise('npx', ['prisma', 'platform', 'auth', 'show', '--early-access'])

        return { content: [{ type: 'text', text: res.stdout + '\n' + res.stderr }] }
      },
    )

    server.tool(
      'Create-Prisma-Postgres-Database',
      `Create a new online Prisma Postgres database.
      Specify a name that makes sense to the user - maybe the name of the project they are working on
      Specify a region that makes sense for the user. Pick between these three options: us-east-1, eu-west-3, ap-northeast-1. If you are unsure, pick us-east-1
      If the response idicates that you have reached the workspace plan limit, you should instruct the user to do one of these things:
      - If they want to connect to an existing database, they should go to console.prisma.io and copy the connection string
      - If they want to upgrade their plan, they should go to console.prisma.io and upgrade their plan in order to be able to create more databases
      - If they want to delete a database they no longer need, they should go to console.prisma.io and delete the database project`,
      { name: z.string(), region: z.string() },
      async ({ name, region }) => {
        const res = await spawnAsPromise('npx', [
          'prisma@6.6.0-integration-mcp.2',
          'init',
          '--db',
          '--name',
          name,
          '--region',
          region,
          '--non-interactive',
        ])

        return { content: [{ type: 'text', text: res.stdout + '\n' + res.stderr }] }
      },
    )

    server.tool('Prisma-Login', `Login or create an account in order to be able to use Prisma Postgres.`, async () => {
      const res = await spawnAsPromise('npx', ['prisma', 'platform', 'auth', 'login', '--early-access'])

      return { content: [{ type: 'text', text: res.stdout + '\n' + res.stderr }] }
    })

    server.tool(
      'Prisma-Studio',
      `Open Prisma Studio to view data in your database in a pleasing visual ui.`,
      async () => {
        const res = await spawnAsPromise('npx', ['prisma', 'studio'])

        return { content: [{ type: 'text', text: res.stdout + '\n' + res.stderr }] }
      },
    )

    const transport = new StdioServerTransport()
    await server.connect(transport)

    return ''
  }
}
