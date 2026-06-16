import t from '@bomb.sh/tab'
import type { PrismaConfigInternal } from '@prisma/config'
import { arg, Command, type CommandCompletion, type CompletionOption, HelpError, isError } from '@prisma/internals'
import {
  dbCompletion,
  dbExecuteCompletion,
  dbPullCompletion,
  dbPushCompletion,
  dbSeedCompletion,
  migrateCompletion,
  migrateDeployCompletion,
  migrateDevCompletion,
  migrateDiffCompletion,
  migrateResetCompletion,
  migrateResolveCompletion,
  migrateStatusCompletion,
} from '@prisma/migrate'

import { bootstrapCompletion } from '../bootstrap/Bootstrap'
import { debugInfoCompletion } from '../DebugInfo'
import { formatCompletion } from '../Format'
import { generateCompletion } from '../Generate'
import { initCompletion } from '../Init'
import { mcpCompletion } from '../mcp/MCP'
import { platformCompletion } from '../platform/_Platform'
import { studioCompletion } from '../Studio'
import { validateCompletion } from '../Validate'
import { versionCompletion } from '../Version'

// `dev` is implemented in `@prisma/cli-dev` (loaded via `SubCommand` in bin.ts),
// so its descriptor lives here rather than colocated with the command.
const devCompletion: CommandCompletion = {
  name: 'dev',
  description: 'Start a local Prisma Postgres server for development',
  options: [
    {
      name: 'name',
      description: 'Target a specific database instance',
      values: [{ value: 'my-db', description: 'Example database name' }],
    },
    {
      name: 'n',
      description: 'Short for --name',
      values: [{ value: 'my-db', description: 'Example database name' }],
    },
    {
      name: 'port',
      description: 'Main port number for the HTTP server',
      values: [{ value: '51213', description: 'Default HTTP server port' }],
    },
    {
      name: 'p',
      description: 'Short for --port',
      values: [{ value: '51213', description: 'Default HTTP server port' }],
    },
    {
      name: 'db-port',
      description: 'Port number for the database server',
      values: [{ value: '51214', description: 'Default database port' }],
    },
    {
      name: 'P',
      description: 'Short for --db-port',
      values: [{ value: '51214', description: 'Default database port' }],
    },
    {
      name: 'shadow-db-port',
      description: 'Port number for the shadow database server',
      values: [{ value: '51215', description: 'Default shadow database port' }],
    },
    { name: 'debug', description: 'Enable debug mode' },
  ],
}

const ALL_COMPLETIONS: CommandCompletion[] = [
  initCompletion,
  bootstrapCompletion,
  devCompletion,
  generateCompletion,
  studioCompletion,
  validateCompletion,
  formatCompletion,
  versionCompletion,
  debugInfoCompletion,
  mcpCompletion,
  platformCompletion,
  dbCompletion,
  dbExecuteCompletion,
  dbPullCompletion,
  dbPushCompletion,
  dbSeedCompletion,
  migrateCompletion,
  migrateDevCompletion,
  migrateResetCompletion,
  migrateDeployCompletion,
  migrateStatusCompletion,
  migrateResolveCompletion,
  migrateDiffCompletion,
]

function registerCompletion(descriptor: CommandCompletion): void {
  const command = t.command(descriptor.name, descriptor.description)

  for (const option of descriptor.options ?? []) {
    registerOption(command, option)
  }

  for (const subcommand of descriptor.subcommands ?? []) {
    registerCompletion(subcommand)
  }
}

function registerOption(command: ReturnType<typeof t.command>, option: CompletionOption): void {
  if (option.values === undefined) {
    command.option(option.name, option.description)
    return
  }

  command.option(option.name, option.description, (complete) => {
    const values = typeof option.values === 'function' ? option.values() : (option.values ?? [])
    for (const v of values) {
      complete(v.value, v.description ?? '')
    }
  })
}

export class Completions implements Command {
  public static new(): Completions {
    return new Completions()
  }

  public parse(argv: string[], _config: PrismaConfigInternal): Promise<string | Error> {
    if (argv[0] === '--') {
      this.setupCompletions()
      try {
        t.parse(argv.slice(1))
        return Promise.resolve('')
      } catch (e) {
        return Promise.resolve(new Error(`Failed to parse completions: ${e}`))
      }
    }

    const args = arg(argv, {})

    if (isError(args)) {
      return Promise.resolve(new HelpError(args.message))
    }

    const firstArg = args._[0]

    if (firstArg && ['zsh', 'bash', 'fish', 'powershell'].includes(firstArg)) {
      this.setupCompletions()
      try {
        t.setup('prisma', 'prisma', firstArg)
        return Promise.resolve('')
      } catch (e) {
        return Promise.resolve(new Error(`Failed to setup completions: ${e}`))
      }
    }

    return Promise.resolve(new HelpError('Invalid shell type. Must be one of: zsh, bash, fish, powershell'))
  }

  private setupCompletions(): void {
    for (const descriptor of ALL_COMPLETIONS) {
      registerCompletion(descriptor)
    }
  }
}
