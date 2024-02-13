import Debug from '@prisma/debug'
import { arg, Commands, format, getCommandWithExecutor, HelpError, isError, link } from '@prisma/internals'
import Arg from 'arg'
import fs from 'fs-extra'
import { bold, dim, green, red } from 'kleur/colors'
import fetch, { Headers } from 'node-fetch'
import path from 'path'
import XdgAppPaths from 'xdg-app-paths'

import { name as PRISMA_CLI_NAME, version as PRISMA_CLI_VERSION } from '../../package.json'

const debug = Debug('prisma:cli:platform')

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
} as const

export const getOptionalParameter = <$Args extends Record<string, unknown>, $Names extends (keyof $Args)[]>(
  args: $Args,
  names: $Names,
  environmentVariable?: string,
): $Args[$Names[number]] => {
  const entry = Object.entries(args).find(([key]) => names.includes(key))
  if (!entry) {
    // TODO document for our users when the CLI goes production that environment variables are overridden by flags
    if (environmentVariable) {
      const value = process.env[environmentVariable]
      if (value) {
        return value as any
      }
    }
  }
  return (entry?.[1] ?? undefined) as any
}

export function argOrThrow<T extends Arg.Spec>(argv: string[], spec: T): Arg.Result<T> {
  const args = arg(argv, spec)
  if (isError(args)) throw args
  return args
}

export const getRequiredParameter = <$Args extends Record<string, unknown>, $Names extends (keyof $Args)[]>(
  args: $Args,
  names: $Names,
  environmentVariable?: string,
): Error | Exclude<$Args[$Names[number]], undefined> => {
  const value = getOptionalParameter(args, names, environmentVariable)
  if (value === undefined) return new Error(`Missing ${names.join(' or ')} parameter`)
  return value as any
}

export const getRequiredParameterOrThrow = <$Args extends Record<string, unknown>, $Names extends (keyof $Args)[]>(
  args: $Args,
  names: $Names,
  environmentVariable?: string,
): Exclude<$Args[$Names[number]], undefined> => {
  const value = getRequiredParameter(args, names, environmentVariable)
  if (value instanceof Error) throw new Error(`Missing ${names.join(' or ')} parameter`)
  return value
}

export const ErrorPlatformUnauthorized = new Error(
  `No platform credentials found. Run ${green(
    getCommandWithExecutor('prisma platform login'),
  )} first. Alternatively you can provide a token via the \`--token\` or \`-t\` parameters, or set the 'PRISMA_TOKEN' environment variable with a token.`,
)

export type PlatformError<$Types extends string = string> = {
  __typename: $Types
  message: string
}

export const errorFromPlatformError = (error: PlatformError): Error => {
  return new Error(error.message)
}

export const getPlatformTokenOrThrow = async <$Args extends Record<string, unknown>>(args: $Args) => {
  try {
    let token = getOptionalParameter(args, ['--token', '-t'], 'PRISMA_TOKEN') as string
    if (!token) {
      const authJson = await readAuthConfig()
      if (isError(authJson)) throw authJson
      token = authJson.token ?? ''
    }
    if (!token) throw ErrorPlatformUnauthorized
    return token
  } catch (error) {
    debug('Error from getPlatformToken()', error)
    throw ErrorPlatformUnauthorized
  }
}

export const platformConsoleUrl = new URL('https://console.prisma.io')
const platformAPIEndpoint = new URL('http://localhost:8788/api')
const accelerateConnectionStringUrl = 'prisma://accelerate.prisma-data.net'
/**
 *
 * @remarks
 *
 * TODO Feedback from Joel:
 *    It could be interesting to set a default timeout because it's not part of fetch spec, see:
 *    npmjs.com/package/node-fetch#request-cancellation-with-abortsignal
 */
export const platformRequestOrThrow = async <
  $Data extends object = object,
  $Input extends null | object = null,
  $Variables extends null | object = null,
>(params: {
  token: string
  body: $Input extends null
    ? $Variables extends null
      ? {
          query: string
          variables?: undefined
        }
      : {
          query: string
          variables: $Variables
        }
    : {
        query: string
        variables: { input: $Input }
      }
}): Promise<$Data> => {
  const method = 'POST'
  const headers = new Headers({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${params.token}`,
    // See https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/User-Agent
    'User-Agent': `${PRISMA_CLI_NAME}/${PRISMA_CLI_VERSION}`,
  })
  const body = JSON.stringify(params.body)
  const response = await fetch(platformAPIEndpoint.href, { method, headers, body })
  const text = await response.text()
  if (response.status >= 400) throw new Error(text)

  const json = JSON.parse(text) as { data: $Data; error: null | object }
  if (json.error) throw new Error(`Error from PDP Platform API: ${text}`)

  const error = Object.values(json).filter(
    (_): _ is { __typename: string } => typeof _ === 'object' && _ !== null && _['__typename']?.startsWith('Error'),
  )[0]
  if (error) throw errorFromPlatformError({ message: '<message not selected from server>', ...error })

  return json.data
}

export const dispatchToSubCommand = async (commands: Commands, argv: string[]) => {
  const commandName = argv[0]
  if (!commandName) return new HelpError(`Unknown command.`)
  const command = commands[commandName]
  if (!command) return new HelpError(`Unknown command or parameter "${commandName}"`)

  // Temporary text until it's added properly in each sub command
  const hasHelpFlag = Boolean(argv.find((it) => ['-h', '--help'].includes(it)))
  if (hasHelpFlag) {
    return `Help output for this command will be available soon. In the meantime, visit ${link(
      'https://pris.ly/cli/platform-docs',
    )} for more information.`
  }

  const result = await command.parse(argv.slice(1))
  return result
}

interface HelpContent {
  command?: string
  subcommand?: string
  subcommands?: string[][]
  options?: string[][]
  examples?: string[]
  additionalContent?: string[]
}

export const createHelp = (content: HelpContent) => {
  const { command, subcommand, subcommands, options, examples, additionalContent } = content
  const command_ = subcommand
    ? `prisma platform ${command} ${subcommand}`
    : command && subcommands
    ? `prisma platform ${command} [command]`
    : `prisma platform [command]`

  const usage = format(`
${bold('Usage')}

  ${dim('$')} ${command_} [options]
`)

  // prettier-ignore
  const commands = subcommands && format(`
${bold('Commands')}

${subcommands.map(([option, description]) => `${option.padStart(15)}   ${description}`).join('\n')}
  `)

  // prettier-ignore
  const options_ = options && format(`
${bold('Options')}

${options.map(([option, alias, description]) => `  ${option.padStart(15)} ${alias && alias+','}   ${description}`).join('\n')}
  `)

  // prettier-ignore
  const examples_ = examples && format(`
${bold('Examples')}

${examples.map(example => `  ${dim('$')} ${example}`).join('\n')}
  `)

  // prettier-ignore
  const additionalContent_ = additionalContent && format(`
${additionalContent.map(entry => `${entry}`).join('\n')}
  `)

  const help = [usage, commands, options_, examples_, additionalContent_].filter(Boolean).join('')
  return (error?: string) => (error ? new HelpError(`\n${bold(red(`!`))} ${error}\n${help}`) : help)
}

/**
 *
 * Output related utils
 *
 */
export const successMessage = (message: string) => `${green('Success!')} ${message}`

export const generateConnectionString = (apiKey: string) => {
  const url = new URL(accelerateConnectionStringUrl)
  url.searchParams.set('api_key', apiKey)
  return bold(url.href)
}

/**
 *
 * Authentication related utils
 *
 */
export interface AuthConfig {
  token?: string | null
}

export const configDirectoryPath = new XdgAppPaths('prisma-platform-cli').config()
export const authConfigPath = path.join(configDirectoryPath, 'auth.json')

export async function writeAuthConfig(data: AuthConfig) {
  try {
    await fs.mkdirp(configDirectoryPath)
    return await fs.writeJSON(authConfigPath, data)
  } catch (error) {
    debug('Error from writeAuthConfig()', error)
    // TODO: Consider adding errorFromMaybeError helper
    return error as Error
  }
}

export async function readAuthConfig(): Promise<AuthConfig | Error> {
  try {
    if (!(await fs.pathExists(authConfigPath))) {
      return {
        token: null,
      }
    }
    return await loadJsonFile(authConfigPath)
  } catch (error) {
    debug('Error from readAuthConfig()', error)
    return error as Error
  }
}

export async function deleteAuthConfig() {
  try {
    if (!(await fs.pathExists(authConfigPath))) {
      return {
        token: null,
      }
    }
    return await fs.remove(authConfigPath)
  } catch (error) {
    debug('Error from deleteAuthConfig()', error)
    return error as Error
  }
}

/**
 * Load JSON file.
 * Inspired by @link https://github.com/sindresorhus/load-json-file/blob/main/index.js
 * @remark Eventually this helper could be moved to @prisma/internals
 */

type JsonValue = string | number | boolean | null | { [Key in string]?: JsonValue } | JsonValue[]
type Reviver = (this: unknown, key: string, value: unknown) => unknown
type BeforeParse = (data: string) => string
interface Options {
  /** Applies a function to the JSON string before parsing. */
  readonly beforeParse?: BeforeParse
  /**
   * Prescribes how the value originally produced by parsing is transformed, before being returned.
   * See the @link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse#Using_the_reviver_parameter for more.
   */
  readonly reviver?: Reviver
}

const parse = (buffer: Buffer, { beforeParse, reviver }: Options = {}) => {
  let data = new TextDecoder().decode(buffer)
  if (typeof beforeParse === 'function') {
    data = beforeParse(data)
  }
  return JSON.parse(data, reviver)
}

/**
 * Loads a JSON file that removes BOM.
 */
export const loadJsonFile = async <ReturnValueType = JsonValue>(
  filePath: string,
  options?: Options,
): Promise<ReturnValueType> => {
  const buffer = await fs.readFile(filePath)
  return parse(buffer, options)
}
