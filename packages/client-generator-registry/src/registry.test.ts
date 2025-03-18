import { Generator } from '@prisma/generator'
import { GeneratorRegistryEntry } from '@prisma/internals'
import { describe, expect, it, vi } from 'vitest'

import { GeneratorRegistry } from './registry'

describe('GeneratorRegistry', () => {
  // Create a mock Generator for testing
  const createMockGenerator = (name: string): Generator => ({
    name,
    generate: vi.fn(),
    getManifest: vi.fn(),
  })

  it('should add a generator to the registry', () => {
    const registry = new GeneratorRegistry()
    const mockGenerator = createMockGenerator('test-generator')

    registry.add(mockGenerator)

    const internal = registry.toInternal()
    expect(internal).toHaveProperty('test-generator')
    expect(internal['test-generator']).toEqual({
      type: 'in-process',
      generator: mockGenerator,
    })
  })

  it('should override an existing generator with the same name', () => {
    const registry = new GeneratorRegistry()
    const firstGenerator = createMockGenerator('duplicate-name')
    const secondGenerator = createMockGenerator('duplicate-name')

    registry.add(firstGenerator)
    registry.add(secondGenerator)

    const internal = registry.toInternal()
    expect((internal['duplicate-name'] as GeneratorRegistryEntry & { type: 'in-process' }).generator).toBe(
      secondGenerator,
    )
  })

  it('should convert to internal registry format correctly', () => {
    const registry = new GeneratorRegistry()
    const generator1 = createMockGenerator('generator-1')
    const generator2 = createMockGenerator('generator-2')

    registry.add(generator1)
    registry.add(generator2)

    const internal = registry.toInternal()
    expect(Object.keys(internal)).toHaveLength(2)
    expect(internal).toEqual({
      'generator-1': {
        type: 'in-process',
        generator: generator1,
      },
      'generator-2': {
        type: 'in-process',
        generator: generator2,
      },
    })
  })

  it('should return an empty object when no generators are added', () => {
    const registry = new GeneratorRegistry()

    const internal = registry.toInternal()

    expect(internal).toEqual({})
    expect(Object.keys(internal)).toHaveLength(0)
  })
})
