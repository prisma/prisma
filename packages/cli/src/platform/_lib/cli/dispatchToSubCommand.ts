import type { PrismaConfigInternal } from '@prisma/config'
import { type Commands, HelpError, link } from '@prisma/internals'

export const dispatchToSubCommand = async (commands: Commands, argv: string[], config: PrismaConfigInternal) => {
  const commandName = argv[0]
  if (!commandName) return new HelpError('Unknown command.')
  const command = commands[commandName]
  if (!command) return new HelpError(`Unknown command or parameter "${commandName}"`)

  // Temporary text until it's added properly in each sub command
  const hasHelpFlag = Boolean(argv.find((it) => ['-h', '--help'].includes(it)))
  if (hasHelpFlag)
    return `Help output for this command will be available soon. In the meantime, visit ${link('https://pris.ly/cli/platform-docs')} for more information.` // prettier-ignore

  const result = await command.parse(argv.slice(1), config)
  return result
}
