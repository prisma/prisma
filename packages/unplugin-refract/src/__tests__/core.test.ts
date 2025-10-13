import { beforeEach, describe, expect, it, vi } from 'vitest'

import { unpluginRefract } from '../core.js'

// Mock dependencies
vi.mock('chokidar', () => ({
  watch: vi.fn(() => ({
    on: vi.fn(),
    close: vi.fn(),
  })),
}))

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}))

vi.mock('@refract/schema-parser', () => ({
  parseSchema: vi.fn(),
}))

describe('unpluginRefract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create plugin instance', () => {
    const plugin = unpluginRefract.vite({
      schema: './test-schema.prisma',
      debug: true,
    })

    expect(plugin).toBeDefined()
    expect(plugin.name).toBe('unplugin-refract')
  })

  it('should have correct exports for all bundlers', () => {
    expect(unpluginRefract.vite).toBeDefined()
    expect(unpluginRefract.webpack).toBeDefined()
    expect(unpluginRefract.rollup).toBeDefined()
    expect(unpluginRefract.esbuild).toBeDefined()
  })

  it('should resolve .refract/types imports', () => {
    const plugin = unpluginRefract.raw({})
    const resolveId = plugin.resolveId

    if (resolveId) {
      const result = resolveId('.refract/types')
      expect(result).toBe('virtual:refract/types')
    }
  })

  it('should handle virtual module loading', () => {
    const plugin = unpluginRefract.raw({})
    const load = plugin.load

    if (load) {
      // Should return empty export for missing virtual modules to prevent build errors
      const result = load('virtual:refract/types')
      expect(result).toBe('export {}')
    }
  })
})
