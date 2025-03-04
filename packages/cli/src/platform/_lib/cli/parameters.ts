import { arg, isError } from '@prisma/internals'
import type Arg from 'arg'

export const getRequiredParameter = <$Args extends Record<string, unknown>, $Names extends (keyof $Args)[]>(
  args: $Args,
  names: $Names,
  environmentVariable?: string,
): Error | Exclude<$Args[$Names[number]], undefined> => {
  const value = getOptionalParameter(args, names, environmentVariable)
  if (value === undefined) return new Error(`Missing ${names.join(' or ')} parameter`)
  return value as any
}

export function argOrThrow<T extends Arg.Spec>(argv: string[], spec: T): Arg.Result<T> {
  const args = arg(argv, spec)
  if (isError(args)) throw args
  return args
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
