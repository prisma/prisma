import Debug from '@prisma/debug'
import { Commands, getCommandWithExecutor, unknownCommand } from '@prisma/internals'
import fs from 'fs-extra'
import { green } from 'kleur/colors'
import fetch, { Headers } from 'node-fetch'
import path from 'path'
import XdgAppPaths from 'xdg-app-paths'

import { getInstalledPrismaClientVersion } from './getClientVersion'

const debug = Debug('prisma:cli:platform')

export const platformParameters = {
  global: {
    // TODO Remove this from global once we have a way for parents to strip out flags upon parsing.
    '--early-access-feature': Boolean,
    '--token': String,
    '-t': '--token',
  },
  workspace: {
    '--early-access-feature': Boolean,
    '--token': String,
    '-t': '--token',
    '--workspace': String,
    '-w': '--workspace',
  },
  project: {
    '--early-access-feature': Boolean,
    '--token': String,
    '-t': '--token',
    '--workspace': String,
    '-w': '--workspace',
    '--project': String,
    '-p': '--project',
  },
} as const

export const getOptionalParameter = <$Args extends Record<string, unknown>, $Names extends (keyof $Args)[]>(
  args: $Args,
  names: $Names,
  environmentVariable?: string,
): Exclude<$Args[$Names[number]], undefined> => {
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

export const getRequiredParameter = <$Args extends Record<string, unknown>, $Names extends (keyof $Args)[]>(
  args: $Args,
  names: $Names,
  environmentVariable?: string,
): Error | Exclude<$Args[$Names[number]], undefined> => {
  const value = getOptionalParameter(args, names, environmentVariable)
  if (value === undefined) return new Error(`Missing value for ${names.join(' or ')} parameter`)
  return value
}

export const ErrorPlatformUnauthorized = new Error(
  `No platform credentials found. Run ${green(
    getCommandWithExecutor('prisma platform login'),
  )} first. Alternatively you can provide a token via the \`--token\` or \`-t\` parameters, or set the 'PRISMA_TOKEN' environment variable with a token.`,
)

export const getPlatformTokenOrThrow = async <$Args extends Record<string, unknown>>(args: $Args) => {
  try {
    const token =
      getOptionalParameter(args, ['--token', '-t'], 'PRISMA_TOKEN') ||
      (await readAuthConfig().catch(() => ({ token: '' }))).token
    if (!token) throw ErrorPlatformUnauthorized
    return token
  } catch (error) {
    debug('Error from getPlatformToken()', error)
    throw ErrorPlatformUnauthorized
  }
}

/**
 * @remark
 * For the time being, console and api url are the same. This will change in the future.
 */
export const platformConsoleUrl = 'https://console.prisma.io'
const platformAPIBaseURL = 'https://console.prisma.io/'

/**
 *
 * @remarks
 *
 * TODO Feedback from Joel:
 *    It could be interesting to set a default timeout because it's not part of fetch spec, see:
 *    npmjs.com/package/node-fetch#request-cancellation-with-abortsignal
 */
export const platformRequestOrThrow = async (params: {
  route: string
  token: string
  path: string
  payload?: object
}): Promise<object> => {
  const { path, payload, token, route } = params
  const url = new URL(`${platformAPIBaseURL}${path.replace(/^\//, '')}?_data=routes/${route}`)
  // TODO error handling, when this fails, do not fail the request
  const prismaClientVersion = await getInstalledPrismaClientVersion()
  const headers = new Headers({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'user-agent': `prisma@${prismaClientVersion}`,
  })
  const response = await fetch(url, {
    method: payload ? 'POST' : 'GET',
    headers,
    body: payload ? JSON.stringify(payload) : undefined,
  })
  const text = await response.text()
  const json = JSON.parse(text || '""')
  return json
}

export const dispatchToSubCommand = async (commands: Commands, argv: string[]) => {
  const next = argv[0]
  if (!next) return ''
  if (next.startsWith('-')) return ''
  const commandName = next
  const command = commands[commandName]
  if (!command) return unknownCommand('', commandName)
  const result = await command.parse(argv.slice(1))
  return result
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
  await fs.mkdirp(configDirectoryPath)

  return await fs.writeJSON(authConfigPath, data)
}

export async function readAuthConfig(): Promise<AuthConfig> {
  if (!(await fs.pathExists(authConfigPath))) {
    return {
      token: null,
    }
  }

  return await fs.readJSON(authConfigPath)
}

export async function deleteAuthConfig() {
  if (!(await fs.pathExists(authConfigPath))) {
    return {
      token: null,
    }
  }

  return await fs.remove(authConfigPath)
}
