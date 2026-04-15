import type { EnvValue, GeneratorConfig } from '@prisma/generator'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { isGeneratorEnabled, resolveEnabledField } from '../get-generators/utils/isGeneratorEnabled'

function createMockGenerator(enabled?: EnvValue): GeneratorConfig {
  return {
    name: 'test-generator',
    provider: { value: 'test-provider', fromEnvVar: null },
    output: null,
    enabled,
    config: {},
    binaryTargets: [],
    previewFeatures: [],
    sourceFilePath: '/test/schema.prisma',
  }
}

describe('isGeneratorEnabled', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('when no enabled field is set', () => {
    it('should return true (enabled by default)', () => {
      const generator = createMockGenerator()
      expect(isGeneratorEnabled(generator)).toBe(true)
    })
  })

  describe('with fromEnvVar (env() syntax)', () => {
    it('should return true when env var is not set', () => {
      delete process.env.MY_GENERATOR_ENABLED
      const generator = createMockGenerator({ fromEnvVar: 'MY_GENERATOR_ENABLED', value: null })
      expect(isGeneratorEnabled(generator)).toBe(true)
    })

    describe('truthy values (should enable)', () => {
      const truthyValues = ['true', 'TRUE', 'True', '1', 'yes', 'YES', 'on', 'ON', 'anything', 'enabled']

      it.each(truthyValues)('should return true when env var is "%s"', (value) => {
        process.env.MY_GENERATOR_ENABLED = value
        const generator = createMockGenerator({ fromEnvVar: 'MY_GENERATOR_ENABLED', value: null })
        expect(isGeneratorEnabled(generator)).toBe(true)
      })
    })

    describe('falsy values (should disable)', () => {
      const falsyValues = ['false', 'FALSE', 'False', '0', 'no', 'NO', 'No', 'off', 'OFF', 'Off', '']

      it.each(falsyValues)('should return false when env var is "%s"', (value) => {
        process.env.MY_GENERATOR_ENABLED = value
        const generator = createMockGenerator({ fromEnvVar: 'MY_GENERATOR_ENABLED', value: null })
        expect(isGeneratorEnabled(generator)).toBe(false)
      })
    })

    it('should handle whitespace in values', () => {
      process.env.MY_GENERATOR_ENABLED = '  false  '
      const generator = createMockGenerator({ fromEnvVar: 'MY_GENERATOR_ENABLED', value: null })
      expect(isGeneratorEnabled(generator)).toBe(false)
    })

    it('should handle whitespace in truthy values', () => {
      process.env.MY_GENERATOR_ENABLED = '  true  '
      const generator = createMockGenerator({ fromEnvVar: 'MY_GENERATOR_ENABLED', value: null })
      expect(isGeneratorEnabled(generator)).toBe(true)
    })
  })

  describe('with direct value', () => {
    it.each(['true', '1', 'yes', 'on', 'anything'])('should return true for direct value "%s"', (value) => {
      const generator = createMockGenerator({ fromEnvVar: null, value })
      expect(isGeneratorEnabled(generator)).toBe(true)
    })

    it.each(['false', '0', 'no', 'off', ''])('should return false for direct value "%s"', (value) => {
      const generator = createMockGenerator({ fromEnvVar: null, value })
      expect(isGeneratorEnabled(generator)).toBe(false)
    })
  })
})

describe('resolveEnabledField', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should resolve env var value into the enabled field', () => {
    process.env.MY_ENABLED = 'false'
    const generator = createMockGenerator({ fromEnvVar: 'MY_ENABLED', value: null })

    resolveEnabledField(generator)

    expect(generator.enabled).toEqual({
      fromEnvVar: 'MY_ENABLED',
      value: 'false',
    })
  })

  it('should not modify enabled if env var is not set', () => {
    delete process.env.MY_ENABLED
    const generator = createMockGenerator({ fromEnvVar: 'MY_ENABLED', value: null })

    resolveEnabledField(generator)

    expect(generator.enabled).toEqual({
      fromEnvVar: 'MY_ENABLED',
      value: null,
    })
  })

  it('should not modify generator without enabled field', () => {
    const generator = createMockGenerator()

    resolveEnabledField(generator)

    expect(generator.enabled).toBeUndefined()
  })
})
