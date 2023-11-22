import { Commands } from '@prisma/internals'
import fetch, { Headers } from 'node-fetch'

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

export const getRequiredParameterOrThrow = <$Args extends Record<string, unknown>, $Names extends (keyof $Args)[]>(
  args: $Args,
  names: $Names,
  environmentVariable?: string,
): Exclude<$Args[$Names[number]], undefined> => {
  const value = getOptionalParameter(args, names, environmentVariable)
  if (value === undefined) {
    throw new Error(`Missing ${names.join(' or ')}`)
  }
  return value
}

const platformAPIBaseURL = 'https://console.prisma.io/'

export const platformRequestOrThrow = async (params: {
  route: string
  token: string
  path: string
  payload?: object
}) => {
  const { path, payload, token, route } = params
  const url = new URL(`${platformAPIBaseURL}${path.replace(/^\//, '')}?_data=routes/${route}`)
  const headers = new Headers({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  })
  const response = await fetch(url, {
    method: payload ? 'POST' : 'GET',
    headers,
    body: payload ? JSON.stringify(payload) : undefined,
  })
  const text = await response.text()
  const json = JSON.parse(text)
  return json
}

export const dispatchToSubCommand = async (commands: Commands, argv: string[]) => {
  const next = argv[0]
  if (!next) return ''
  if (next.startsWith('-')) return ''
  const commandName = next
  const command = commands[commandName]
  if (!command) throw new Error(`Command ${commandName} not found`)
  const result = await command.parse(argv.slice(1))
  return result
}
