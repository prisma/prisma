import { Commands } from '@prisma/internals'
import Arg from 'arg'
import fetch, { Headers } from 'node-fetch'

export const platformParameters = {
  global: {
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

export const platformRequestOrThrow = async (params: {
  route: string
  token: string
  path: string
  payload: object
}) => {
  const { path, payload, token, route } = params
  const url = new URL(`https://console.prisma.io/${path.replace(/^\//, '')}?_data=routes/${route}`)
  const headers = new Headers({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  })
  const body = JSON.stringify(payload)
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
  })
  const text = await response.text()
  const json = JSON.stringify(text)
  return json
}

export const dispatchToSubCommand = async (commands: Commands, args: Arg.Result<{}>) => {
  const commandName = args._[0]
  const command = commands[commandName]
  if (!command) throw new Error(`Command ${commandName} not found`)
  const result = await command.parse(args._.slice(1))
  return result
}
