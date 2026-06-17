import t from '@bomb.sh/tab'
import type { PrismaConfigInternal } from '@prisma/config'
import {
  arg,
  Command,
  type CommandCompletion,
  completionDevDbPorts,
  completionDevHttpPorts,
  completionDevServerNames,
  completionDevShadowDbPorts,
  type CompletionOption,
  HelpError,
  isError,
} from '@prisma/internals'
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
import { postgresLinkCompletion } from '../postgres/link/Link'
import { postgresCompletion } from '../postgres/PostgresCommand'
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
      alias: 'n',
      description: 'Name of the server (helps keep state isolated between different projects)',
      values: completionDevServerNames,
    },
    {
      name: 'port',
      alias: 'p',
      description: 'Main port number for the HTTP server',
      values: completionDevHttpPorts,
    },
    {
      name: 'db-port',
      alias: 'P',
      description: 'Port number for the database server',
      values: completionDevDbPorts,
    },
    {
      name: 'shadow-db-port',
      description: 'Port number for the shadow database server',
      values: completionDevShadowDbPorts,
    },
    { name: 'detach', alias: 'd', description: 'Run the server in the background' },
    { name: 'debug', description: 'Enable debug logging' },
  ],
}

const devDebugOption: CompletionOption = { name: 'debug', description: 'Enable debug logging' }

const devLsCompletion: CommandCompletion = {
  name: 'dev ls',
  description: 'List available servers',
  options: [devDebugOption],
}

const devRmCompletion: CommandCompletion = {
  name: 'dev rm',
  description: 'Remove servers',
  options: [devDebugOption, { name: 'force', description: 'Stop any running servers before removing them' }],
}

const devStartCompletion: CommandCompletion = {
  name: 'dev start',
  description: 'Start one or more stopped servers',
  options: [devDebugOption],
}

const devStopCompletion: CommandCompletion = {
  name: 'dev stop',
  description: 'Stop servers',
  options: [devDebugOption],
}

const SUPPORTED_SHELLS = ['zsh', 'bash', 'fish', 'powershell'] as const

const completeCompletion: CommandCompletion = {
  name: 'complete',
  description: 'Generate shell completion script',
  subcommands: SUPPORTED_SHELLS.map((shell) => ({
    name: `complete ${shell}`,
    description: `Generate completion script for ${shell}`,
  })),
}

const ALL_COMPLETIONS: CommandCompletion[] = [
  initCompletion,
  bootstrapCompletion,
  devCompletion,
  devLsCompletion,
  devRmCompletion,
  devStartCompletion,
  devStopCompletion,
  generateCompletion,
  studioCompletion,
  validateCompletion,
  formatCompletion,
  versionCompletion,
  debugInfoCompletion,
  mcpCompletion,
  platformCompletion,
  postgresCompletion,
  postgresLinkCompletion,
  completeCompletion,
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
    if (option.alias !== undefined) {
      command.option(option.name, option.description, option.alias)
    } else {
      command.option(option.name, option.description)
    }
    return
  }

  command.option(
    option.name,
    option.description,
    (complete) => {
      const values = typeof option.values === 'function' ? option.values() : (option.values ?? [])
      for (const v of values) {
        complete(v.value, v.description ?? '')
      }
    },
    option.alias,
  )
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

    if (firstArg && (SUPPORTED_SHELLS as readonly string[]).includes(firstArg)) {
      this.setupCompletions()
      try {
        t.setup('prisma', 'prisma', firstArg)
        return Promise.resolve('')
      } catch (e) {
        return Promise.resolve(new Error(`Failed to setup completions: ${e}`))
      }
    }

    return Promise.resolve(new HelpError(`Invalid shell type. Must be one of: ${SUPPORTED_SHELLS.join(', ')}`))
  }

  private setupCompletions(): void {
    for (const descriptor of ALL_COMPLETIONS) {
      registerCompletion(descriptor)
    }
  }
}
