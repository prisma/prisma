import { Commands, getCommandWithExecutor, HelpError, isError, link } from '@prisma/internals'
import { bold, green } from 'kleur/colors'

import { credentialsFile } from './credentials'
import { getOptionalParameter } from './parameters'

export const platformParameters = {
  global: {
    // TODO Remove this from global once we have a way for parents to strip out flags upon parsing.
    '--token': String,
  },
  workspace: {
    '--token': String,
    '--workspace': String,
    '-w': '--workspace',
  },
  project: {
    '--token': String,
    '--project': String,
    '-p': '--project',
  },
  environment: {
    '--token': String,
    '--environment': String,
    '-e': '--environment',
  },
  serviceToken: {
    '--token': String,
    '--serviceToken': String,
    '-s': '--serviceToken',
  },
  apikey: {
    '--token': String,
    '--apikey': String,
  },
} as const

export const ErrorPlatformUnauthorized = new Error(
  `No platform credentials found. Run ${green(getCommandWithExecutor('prisma platform auth login --early-access'))} first. Alternatively you can provide a token via the \`--token\` or \`-t\` parameters, or set the 'PRISMA_TOKEN' environment variable with a token.`, // prettier-ignore
)

export const getTokenOrThrow = async <$Args extends Record<string, unknown>>(args: $Args) => {
  const token = getOptionalParameter(args, ['--token', '-t'], 'PRISMA_TOKEN') as string
  if (token) return token

  const credentials = await credentialsFile.load()
  if (isError(credentials)) throw credentials
  if (!credentials) throw ErrorPlatformUnauthorized

  return credentials.token
}

const accelerateConnectionStringUrl = 'prisma://accelerate.prisma-data.net'

export const dispatchToSubCommand = async (commands: Commands, argv: string[]) => {
  const commandName = argv[0]
  if (!commandName) return new HelpError(`Unknown command.`)
  const command = commands[commandName]
  if (!command) return new HelpError(`Unknown command or parameter "${commandName}"`)

  // Temporary text until it's added properly in each sub command
  const hasHelpFlag = Boolean(argv.find((it) => ['-h', '--help'].includes(it)))
  if (hasHelpFlag) return `Help output for this command will be available soon. In the meantime, visit ${link('https://pris.ly/cli/platform-docs')} for more information.` // prettier-ignore

  const result = await command.parse(argv.slice(1))
  return result
}

/**
 *
 * Output related utils
 *
 */

export const generateConnectionString = (apiKey: string) => {
  const url = new URL(accelerateConnectionStringUrl)
  url.searchParams.set('api_key', apiKey)
  return bold(url.href)
}
