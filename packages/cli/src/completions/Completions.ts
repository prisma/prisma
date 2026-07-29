import t from '@bomb.sh/tab'
import type { PrismaConfigInternal } from '@prisma/config'
import type { Command, CommandCompletion, CompletionOption } from '@prisma/internals'
import { arg, HelpError, isError } from '@prisma/internals'

import { ALL_COMPLETIONS, SUPPORTED_SHELLS } from './completion-definitions'

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
    return Promise.resolve(parseCompletionCommand(argv))
  }
}

export function parseCompletionCommand(argv: string[]): string | Error {
  if (argv[0] === '--') {
    setupCompletions()
    try {
      t.parse(argv.slice(1))
      return ''
    } catch (e) {
      return new Error(`Failed to parse completions: ${e}`)
    }
  }

  const args = arg(argv, {})

  if (isError(args)) {
    return new HelpError(args.message)
  }

  const firstArg = args._[0]

  if (firstArg && (SUPPORTED_SHELLS as readonly string[]).includes(firstArg)) {
    setupCompletions()
    try {
      t.setup('prisma', 'prisma', firstArg)
      return ''
    } catch (e) {
      return new Error(`Failed to setup completions: ${e}`)
    }
  }

  return new HelpError(`Invalid shell type. Must be one of: ${SUPPORTED_SHELLS.join(', ')}`)
}

function setupCompletions(): void {
  for (const descriptor of ALL_COMPLETIONS) {
    registerCompletion(descriptor)
  }
}
