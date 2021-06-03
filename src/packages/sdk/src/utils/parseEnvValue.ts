import {
  ProviderEnvValue,
  BinaryTargetsEnvValue,
} from '@prisma/generator-helper'
import chalk from 'chalk'

export function parseProviderEnvValue(object: ProviderEnvValue) {
  return parseEnvValue(object, 'provider')
}

export function parseBinaryTargetsEnvValue(object: BinaryTargetsEnvValue) {
  return parseEnvValue(object, 'binaryTargets')
}

/**
 * Parses the ProviderEnvValue and return the string value
 *
 * - If there is no env var just return the value
 * - If there is an env var it will be resolve and returned.
 * - If there is an env var is present but can't be resolved an error will be thrown
 */
function parseEnvValue(
  object: ProviderEnvValue | BinaryTargetsEnvValue,
  type: 'provider' | 'binaryTargets',
) {
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

    if (type === 'provider') {
      return value
    } else {
      // value is a string because it's from env var but need to be parsed as an array
      return JSON.parse(value)
    }
  }
  return object.value
}
