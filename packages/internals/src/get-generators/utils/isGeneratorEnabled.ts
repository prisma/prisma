import type { GeneratorConfig } from '@prisma/generator'

const DISABLED_VALUES = new Set(['false', '0', 'no', 'off', ''])

function isDisabledValue(value: string): boolean {
  return DISABLED_VALUES.has(value.toLowerCase().trim())
}

export function isGeneratorEnabled(generator: GeneratorConfig): boolean {
  if (!generator.enabled) {
    return true
  }

  const { fromEnvVar, value } = generator.enabled

  if (value !== null) {
    return !isDisabledValue(value)
  }

  if (fromEnvVar) {
    const envValue = process.env[fromEnvVar]
    if (envValue === undefined) {
      return true
    }
    return !isDisabledValue(envValue)
  }

  return true
}

/**
 * Resolves the enabled field by populating the value from the environment variable.
 * Mutates `generator.enabled` in place, consistent with `resolveBinaryTargets`.
 */
export function resolveEnabledField(generator: GeneratorConfig): void {
  if (generator.enabled?.fromEnvVar) {
    const envValue = process.env[generator.enabled.fromEnvVar]
    if (envValue !== undefined) {
      generator.enabled = {
        fromEnvVar: generator.enabled.fromEnvVar,
        value: envValue,
      }
    }
  }
}
