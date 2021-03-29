import { EnvValue } from '@prisma/generator-helper'
import chalk from 'chalk'

/**
 * Parses the EnvValue and return the string value
 *
 * - If there is no env var just return the value
 * - If there is an env var it will be resolve and returned.
 * - If there is an env var is present but can't be resolved an error will be thrown
 */
export function parseEnvValue(provider: EnvValue) {
  if (provider.fromEnvVar) {
    const value = process.env[provider.fromEnvVar]
    if (!value) {
      throw new Error(
        `Attempted to load provider value using \`env(${
          provider.fromEnvVar
        })\` but it was not present. Please insure that ${chalk.dim(
          provider.fromEnvVar,
        )} is present in your Environment Variables`,
      )
    }
    return value
  }
  return provider.value
}
