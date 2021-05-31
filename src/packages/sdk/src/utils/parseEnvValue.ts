import { EnvValue } from '@prisma/generator-helper'
import chalk from 'chalk'

export function parseProviderEnvValue(object: EnvValue) {
  return parseEnvValue(object, 'provider')
}

export function parseBinaryTargetsEnvValue(object: EnvValue) {
  return parseEnvValue(object, 'binaryTargets')
}

/**
 * Parses the EnvValue and return the string value
 *
 * - If there is no env var just return the value
 * - If there is an env var it will be resolve and returned.
 * - If there is an env var is present but can't be resolved an error will be thrown
 */
function parseEnvValue(object: EnvValue, type: 'provider' | 'binaryTargets') {
  if (object.fromEnvVar && object.fromEnvVar !== null) {
    const value = process.env[object.fromEnvVar]
    if (!value) {
      throw new Error(
        `Attempted to load ${type} value using \`env(${
          object.fromEnvVar
        })\` but it was not present. Please insure that ${chalk.dim(
          object.fromEnvVar,
        )} is present in your Environment Variables`,
      )
    }
    return value
  }
  return object.value
}
