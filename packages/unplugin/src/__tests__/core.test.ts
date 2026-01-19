import { beforeEach, describe, expect, it, vi } from 'vitest'

import { unpluginOrk } from '../core.js'

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

vi.mock('@ork-orm/schema-parser', () => ({
  parseSchema: vi.fn(),
}))

describe('unpluginOrk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create plugin instance', () => {
    const plugin = unpluginOrk.vite({
      schema: './test-schema.prisma',
      debug: true,
    })

    expect(plugin).toBeDefined()
    expect(plugin.name).toBe('unplugin-ork')
  })

  it('should have correct exports for all bundlers', () => {
    expect(unpluginOrk.vite).toBeDefined()
    expect(unpluginOrk.webpack).toBeDefined()
    expect(unpluginOrk.rollup).toBeDefined()
    expect(unpluginOrk.esbuild).toBeDefined()
  })
})
