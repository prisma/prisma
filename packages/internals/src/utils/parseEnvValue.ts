import type { EnvValue } from '@prisma/generator'
import { dim } from 'kleur/colors'

/**
 * Parses an EnvValue (example: Provider) and return the string value
 *
 * - If there is no env var just return the value
 * - If there is an env var it will be resolve and returned.
 * - If there is an env var is present but can't be resolved an error will be thrown
 */
export function parseEnvValue(object: EnvValue) {
  if (object.fromEnvVar && object.fromEnvVar != 'null') {
    const value = process.env[object.fromEnvVar]
    if (!value) {
      throw new Error(
        `Attempted to load provider value using \`env(${
          object.fromEnvVar
        })\` but it was not present. Please ensure that ${dim(
          object.fromEnvVar,
        )} is present in your Environment Variables`,
      )
    }

    return value
  }

  return object.value as string
}
