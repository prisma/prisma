import { beforeEach, describe, expect, it, vi } from 'vitest'

import { unpluginRefract } from '../core.js'

// Mock file system
const mockFs = {
  '/test/schema.prisma': `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id       Int    @id @default(autoincrement())
  email    String @unique
  name     String?
  posts    Post[]
}

model Post {
  id     Int    @id @default(autoincrement())
  title  String
  author User   @relation(fields: [authorId], references: [id])
  authorId Int
}
`,
  '/test/missing.prisma': null, // File doesn't exist
}

vi.mock('fs', () => ({
  existsSync: vi.fn((path: string) => {
    return mockFs[path as keyof typeof mockFs] !== null
  }),
  readFileSync: vi.fn((path: string) => {
    const content = mockFs[path as keyof typeof mockFs]
    if (content === null) {
      throw new Error(`File not found: ${path}`)
    }
    return content
  }),
}))

vi.mock('chokidar', () => ({
  watch: vi.fn(() => ({
    on: vi.fn(),
    close: vi.fn(),
  })),
}))

describe('Unplugin Refract Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create working plugin with schema', () => {
    const plugin = unpluginRefract.vite({
      schema: '/test/schema.prisma',
      root: '/test',
      debug: true,
    })

    expect(plugin).toBeDefined()
    expect(plugin.name).toBe('unplugin-refract')
    expect(typeof plugin.resolveId).toBe('function')
    expect(typeof plugin.load).toBe('function')
  })

  it('should resolve .refract/types imports', () => {
    const plugin = unpluginRefract.raw({
      schema: '/test/schema.prisma',
      root: '/test',
    })

    // Trigger buildStart to generate types
    if (plugin.buildStart) {
      plugin.buildStart.call({})
    }

    const resolveId = plugin.resolveId
    if (resolveId) {
      const result = resolveId('.refract/types')
      expect(result).toBe('virtual:refract/types')
    }
  })

  it('should load generated virtual modules', async () => {
    const plugin = unpluginRefract.raw({
      schema: '/test/schema.prisma',
      root: '/test',
      debug: true,
    })

    // Trigger buildStart to generate types
    if (plugin.buildStart) {
      await plugin.buildStart.call({})
    }

    const load = plugin.load
    if (load) {
      const typesContent = load('virtual:refract/types')
      expect(typesContent).toBeDefined()
      expect(typeof typesContent).toBe('string')
      expect(typesContent).toContain('interface User')
      expect(typesContent).toContain('interface Post')
      expect(typesContent).toContain('DatabaseSchema')
      expect(typesContent).toContain('declare module')
    }
  })

  it('should handle missing schema file gracefully', async () => {
    const plugin = unpluginRefract.raw({
      schema: '/test/missing.prisma',
      root: '/test',
    })

    // Trigger buildStart
    if (plugin.buildStart) {
      await plugin.buildStart.call({})
    }

    const load = plugin.load
    if (load) {
      const typesContent = load('virtual:refract/types')
      expect(typesContent).toBeDefined()
      expect(typesContent).toContain('No schema.prisma found')
      expect(typesContent).toContain('DatabaseSchema')
    }
  })

  it('should generate multiple virtual modules', async () => {
    const plugin = unpluginRefract.raw({
      schema: '/test/schema.prisma',
      root: '/test',
    })

    // Trigger buildStart (async)
    if (plugin.buildStart) {
      await plugin.buildStart.call({})
    }

    const load = plugin.load
    if (load) {
      // Test types module
      const typesContent = load('virtual:refract/types')
      expect(typesContent).toContain('interface User')

      // Test index module
      const indexContent = load('virtual:refract/index')
      expect(indexContent).toContain('export * from')

      // Test generated module
      const generatedContent = load('virtual:refract/generated')
      expect(generatedContent).toContain('Generated types from schema.prisma')
    }
  })

  it('should handle different import patterns', () => {
    const plugin = unpluginRefract.raw({
      schema: '/test/schema.prisma',
      root: '/test',
    })

    const resolveId = plugin.resolveId
    if (resolveId) {
      // Test different import patterns
      expect(resolveId('.refract/types')).toBe('virtual:refract/types')
      expect(resolveId('.refract/index')).toBe('virtual:refract/index')
      expect(resolveId('virtual:refract/types')).toBe('virtual:refract/types')
    }
  })

  describe('Production Build Integration', () => {
    beforeEach(() => {
      // Set production environment
      process.env.NODE_ENV = 'production'
    })

    afterEach(() => {
      // Reset environment
      process.env.NODE_ENV = 'test'
    })

    it('should generate optimized modules in production', async () => {
      const plugin = unpluginRefract.raw({
        schema: '/test/schema.prisma',
        root: '/test',
        production: {
          optimize: true,
          cache: false, // Disable cache for testing
        },
      })

      // Trigger buildStart
      if (plugin.buildStart) {
        await plugin.buildStart.call({})
      }

      const load = plugin.load
      if (load) {
        const typesContent = load('virtual:refract/types')
        expect(typesContent).toBeDefined()
        expect(typesContent).toContain('Generated by unplugin-refract - production build')
        expect(typesContent).toContain('interface User')
        expect(typesContent).toContain('interface Post')
      }
    })

    it('should handle production build errors based on failOnError setting', async () => {
      const plugin = unpluginRefract.raw({
        schema: '/test/missing.prisma',
        root: '/test',
        production: {
          failOnError: false,
        },
      })

      // Should not throw in production with failOnError: false
      if (plugin.buildStart) {
        await expect(plugin.buildStart.call({})).resolves.not.toThrow()
      }
    })

    it('should apply Vite-specific optimizations', () => {
      const mockConfig = {
        build: {},
        optimizeDeps: {},
      }

      const plugin = unpluginRefract.vite({
        schema: '/test/schema.prisma',
        root: '/test',
        production: { optimize: true },
      })

      if (plugin.vite?.config) {
        plugin.vite.config(mockConfig)

        expect(mockConfig.optimizeDeps.exclude).toContain('@refract/client')
        expect(mockConfig.optimizeDeps.exclude).toContain('virtual:refract/*')
      }
    })

    it('should generate source maps when enabled', async () => {
      const plugin = unpluginRefract.raw({
        schema: '/test/schema.prisma',
        root: '/test',
        production: {
          sourceMaps: true,
          cache: false,
        },
      })

      // Trigger buildStart
      if (plugin.buildStart) {
        await plugin.buildStart.call({})
      }

      const load = plugin.load
      if (load) {
        // Check that source map reference is included
        const typesContent = load('virtual:refract/types')
        expect(typesContent).toContain('//# sourceMappingURL=types.map')

        // Check that source map exists
        const sourceMapContent = load('virtual:refract/types.map')
        expect(sourceMapContent).toBeDefined()

        const sourceMap = JSON.parse(sourceMapContent as string)
        expect(sourceMap.version).toBe(3)
        expect(sourceMap.file).toBe('types.ts')
      }
    })
  })
})
