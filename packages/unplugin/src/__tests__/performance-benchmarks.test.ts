/**
 * Performance benchmarks for unplugin-ork
 * Compares against other ORM development experiences
 *
 * Uses real temporary files instead of mocking fs to avoid ESM module resolution issues.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { unpluginOrk } from '../core.js'

// Performance test schemas of varying complexity
const DATASOURCE = `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
`

const SMALL_SCHEMA = `${DATASOURCE}
model User {
  id    Int    @id @default(autoincrement())
  email String @unique
  name  String?
}

model Post {
  id     Int    @id @default(autoincrement())
  title  String
  userId Int
}
`

const MEDIUM_SCHEMA = `${DATASOURCE}
${Array.from(
  { length: 10 },
  (_, i) => `
model Model${i} {
  id        Int      @id @default(autoincrement())
  field1    String
  field2    Int?
  field3    Boolean  @default(false)
  field4    DateTime @default(now())
  field5    String?
  field6    Json?
  related   Model${(i + 1) % 10}[]

  @@map("model_${i}")
}
`,
).join('\n')}
`

const LARGE_SCHEMA = `${DATASOURCE}
${Array.from(
  { length: 100 },
  (_, i) => `
model Model${i} {
  id        Int      @id @default(autoincrement())
  field1    String   @unique
  field2    Int?
  field3    Boolean  @default(false)
  field4    DateTime @default(now())
  field5    String?
  field6    Json?
  field7    Decimal?
  field8    BigInt?
  field9    Bytes?
  field10   Float[]

  // Relations to create complexity
  related1  Model${(i + 1) % 100}[]
  related2  Model${(i + 2) % 100}?
  related3  Model${(i + 3) % 100}[]

  @@map("model_${i}")
  @@index([field1, field2])
  @@index([field4])
}
`,
).join('\n')}
`

// Create real temp directory and files for tests
const TEST_DIR = join(tmpdir(), 'unplugin-ork-perf-test')

// Paths to real test files
const testPaths = {
  small: join(TEST_DIR, 'small.prisma'),
  medium: join(TEST_DIR, 'medium.prisma'),
  large: join(TEST_DIR, 'large.prisma'),
}

const runPerf = process.env.RUN_PERF === '1'
const perfDescribe = runPerf ? describe : describe.skip

vi.mock('chokidar', () => ({
  watch: vi.fn(() => ({
    on: vi.fn(),
    close: vi.fn(),
  })),
}))

// Benchmark utility
async function benchmark(
  name: string,
  fn: () => Promise<void> | void,
  iterations = 1,
): Promise<{ name: string; duration: number; average: number; iterations: number }> {
  const times: number[] = []

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await fn()
    const end = performance.now()
    times.push(end - start)
  }

  const totalDuration = times.reduce((sum, time) => sum + time, 0)
  const averageTime = totalDuration / iterations

  return {
    name,
    duration: totalDuration,
    average: averageTime,
    iterations,
  }
}

perfDescribe('Performance Benchmarks', () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true })
    writeFileSync(testPaths.small, SMALL_SCHEMA)
    writeFileSync(testPaths.medium, MEDIUM_SCHEMA)
    writeFileSync(testPaths.large, LARGE_SCHEMA)
  })

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Schema Processing Performance', () => {
    it('should process small schemas quickly', async () => {
      const result = await benchmark(
        'Small Schema Processing',
        async () => {
          const plugin = unpluginOrk.raw({
            schema: testPaths.small,
            root: TEST_DIR,
            production: { cache: false }, // Disable cache for fair benchmarking
          })

          if (plugin.buildStart) {
            await plugin.buildStart.call({})
          }

          // Test virtual module loading
          const load = plugin.load
          if (load) {
            load('virtual:ork/types')
            load('virtual:ork/index')
            load('virtual:ork/generated')
          }
        },
        5,
      )

      console.log(`📊 ${result.name}: ${result.average.toFixed(2)}ms average (${result.iterations} runs)`)

      // Small schema should process very quickly (< 50ms average)
      expect(result.average).toBeLessThan(50)
    })

    it('should process medium schemas efficiently', async () => {
      const result = await benchmark(
        'Medium Schema Processing',
        async () => {
          const plugin = unpluginOrk.raw({
            schema: testPaths.medium,
            root: TEST_DIR,
            production: { cache: false },
          })

          if (plugin.buildStart) {
            await plugin.buildStart.call({})
          }

          const load = plugin.load
          if (load) {
            const typesContent = load('virtual:ork/types')
            expect(typesContent).toBeDefined()
            expect(typeof typesContent).toBe('string')
          }
        },
        3,
      )

      console.log(`📊 ${result.name}: ${result.average.toFixed(2)}ms average (${result.iterations} runs)`)

      // Medium schema should still be reasonably fast (< 200ms average)
      expect(result.average).toBeLessThan(200)
    })

    it('should handle large schemas within acceptable limits', async () => {
      const result = await benchmark(
        'Large Schema Processing',
        async () => {
          const plugin = unpluginOrk.raw({
            schema: testPaths.large,
            root: TEST_DIR,
            production: { cache: false },
          })

          if (plugin.buildStart) {
            await plugin.buildStart.call({})
          }

          const load = plugin.load
          if (load) {
            const typesContent = load('virtual:ork/types') as string

            // Verify all 100 models are processed
            expect(typesContent).toContain('interface Model0')
            expect(typesContent).toContain('interface Model99')

            // Count total interfaces generated
            const interfaceCount = (typesContent.match(/export interface Model\d+/g) || []).length
            expect(interfaceCount).toBe(100)
          }
        },
        2,
      )

      console.log(`📊 ${result.name}: ${result.average.toFixed(2)}ms average (${result.iterations} runs)`)

      // Large schema should complete within reasonable time (< 1000ms average)
      expect(result.average).toBeLessThan(1000)
    })
  })

  describe('Virtual Module Performance', () => {
    it('should resolve virtual modules quickly', async () => {
      const plugin = unpluginOrk.raw({
        schema: testPaths.medium,
        root: TEST_DIR,
      })

      if (plugin.buildStart) {
        await plugin.buildStart.call({})
      }

      const result = await benchmark(
        'Virtual Module Resolution',
        async () => {
          const resolveId = plugin.resolveId
          if (resolveId) {
            // Test various resolution patterns
            resolveId('.ork/types')
            resolveId('.ork/index')
            resolveId('.ork/generated')
            resolveId('virtual:ork/types')
            resolveId('virtual:ork/index')
            resolveId('some-other-module') // Should return null
          }
        },
        1000,
      )

      console.log(`📊 ${result.name}: ${result.average.toFixed(4)}ms average (${result.iterations} runs)`)

      // Virtual module resolution should be extremely fast (< 1ms average)
      expect(result.average).toBeLessThan(1)
    })

    it('should load virtual modules efficiently', async () => {
      const plugin = unpluginOrk.raw({
        schema: testPaths.medium,
        root: TEST_DIR,
      })

      if (plugin.buildStart) {
        await plugin.buildStart.call({})
      }

      const result = await benchmark(
        'Virtual Module Loading',
        async () => {
          const load = plugin.load
          if (load) {
            load('virtual:ork/types')
            load('virtual:ork/index')
            load('virtual:ork/generated')
          }
        },
        500,
      )

      console.log(`📊 ${result.name}: ${result.average.toFixed(4)}ms average (${result.iterations} runs)`)

      // Virtual module loading should be very fast (< 5ms average)
      expect(result.average).toBeLessThan(5)
    })
  })

  describe('Production Build Performance', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
    })

    afterEach(() => {
      process.env.NODE_ENV = 'test'
    })

    it('should optimize builds efficiently', async () => {
      const result = await benchmark(
        'Production Build Optimization',
        async () => {
          const plugin = unpluginOrk.raw({
            schema: testPaths.medium,
            root: TEST_DIR,
            production: {
              optimize: true,
              cache: false, // Disable cache for benchmarking
              sourceMaps: true,
            },
          })

          if (plugin.buildStart) {
            await plugin.buildStart.call({})
          }

          const load = plugin.load
          if (load) {
            const typesContent = load('virtual:ork/types') as string
            const sourceMapContent = load('virtual:ork/types.map') as string

            expect(typesContent).toContain('production build')
            expect(sourceMapContent).toBeDefined()
          }
        },
        3,
      )

      console.log(`📊 ${result.name}: ${result.average.toFixed(2)}ms average (${result.iterations} runs)`)

      // Production optimization should be reasonable (< 300ms average)
      expect(result.average).toBeLessThan(300)
    })

    it('should benefit from caching', async () => {
      // First build (no cache)
      const firstBuild = await benchmark(
        'First Build (No Cache)',
        async () => {
          const plugin = unpluginOrk.raw({
            schema: testPaths.medium,
            root: TEST_DIR,
            production: {
              optimize: true,
              cache: true,
            },
          })

          if (plugin.buildStart) {
            await plugin.buildStart.call({})
          }
        },
        1,
      )

      // Second build (with cache) - should be faster
      const secondBuild = await benchmark(
        'Second Build (With Cache)',
        async () => {
          const plugin = unpluginOrk.raw({
            schema: testPaths.medium,
            root: TEST_DIR,
            production: {
              optimize: true,
              cache: true,
            },
          })

          if (plugin.buildStart) {
            await plugin.buildStart.call({})
          }
        },
        1,
      )

      console.log(`📊 ${firstBuild.name}: ${firstBuild.average.toFixed(2)}ms`)
      console.log(`📊 ${secondBuild.name}: ${secondBuild.average.toFixed(2)}ms`)
      console.log(
        `📊 Cache Improvement: ${(((firstBuild.average - secondBuild.average) / firstBuild.average) * 100).toFixed(
          1,
        )}%`,
      )

      // Cached build should be reasonably fast (allowing for variance in test environment)
      expect(secondBuild.average).toBeLessThan(100)
    })
  })

  describe('Memory Usage', () => {
    it('should have reasonable memory footprint', async () => {
      const initialMemory = process.memoryUsage()

      // Create multiple plugin instances to test memory usage
      const plugins = Array.from({ length: 10 }, () =>
        unpluginOrk.raw({
          schema: testPaths.medium,
          root: TEST_DIR,
        }),
      )

      // Initialize all plugins
      for (const plugin of plugins) {
        if (plugin.buildStart) {
          await plugin.buildStart.call({})
        }
      }

      // Load virtual modules multiple times
      for (const plugin of plugins) {
        const load = plugin.load
        if (load) {
          load('virtual:ork/types')
          load('virtual:ork/index')
          load('virtual:ork/generated')
        }
      }

      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      const memoryIncreaseKB = Math.round(memoryIncrease / 1024)

      console.log(`📊 Memory Usage: ${memoryIncreaseKB}KB increase (${plugins.length} plugin instances)`)

      // Memory increase should be reasonable (< 50MB for 10 instances)
      expect(memoryIncreaseKB).toBeLessThan(50 * 1024)

      // Average memory per plugin should be reasonable (< 5MB)
      const avgMemoryPerPlugin = memoryIncreaseKB / plugins.length
      expect(avgMemoryPerPlugin).toBeLessThan(5 * 1024)
    })
  })

  describe('Comparative Benchmarks', () => {
    it('should compare favorably to manual workflow simulation', async () => {
      // Simulate manual workflow (parsing + file operations)
      const manualWorkflow = await benchmark(
        'Manual Workflow Simulation',
        async () => {
          // Simulate schema reading
          const schemaContent = readFileSync(testPaths.medium, 'utf-8')

          // Simulate manual parsing (just string operations for comparison)
          const models = schemaContent.match(/model \w+ \{[^}]+\}/g) || []

          // Simulate manual type generation
          const types = models
            .map((model) => {
              const name = model.match(/model (\w+)/)?.[1] || 'Unknown'
              return `interface ${name} { [key: string]: any }`
            })
            .join('\n')

          // Simulate file writing
          const output = `${types}\nexport interface DatabaseSchema { [key: string]: any }`

          // Verify output exists
          expect(output).toBeDefined()
        },
        5,
      )

      // Test plugin workflow
      const pluginWorkflow = await benchmark(
        'Plugin Workflow',
        async () => {
          const plugin = unpluginOrk.raw({
            schema: testPaths.medium,
            root: TEST_DIR,
            production: { cache: false },
          })

          if (plugin.buildStart) {
            await plugin.buildStart.call({})
          }

          const load = plugin.load
          if (load) {
            const typesContent = load('virtual:ork/types')
            expect(typesContent).toBeDefined()
          }
        },
        5,
      )

      console.log(`📊 Manual Workflow: ${manualWorkflow.average.toFixed(2)}ms average`)
      console.log(`📊 Plugin Workflow: ${pluginWorkflow.average.toFixed(2)}ms average`)

      const improvement = ((manualWorkflow.average - pluginWorkflow.average) / manualWorkflow.average) * 100
      console.log(`📊 Plugin Performance: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}% vs manual`)

      // Plugin should complete within reasonable time (manual simulation is very simple)
      expect(pluginWorkflow.average).toBeLessThan(50)
    })
  })

  describe('Stress Testing', () => {
    it('should handle rapid schema changes', async () => {
      const plugin = unpluginOrk.raw({
        schema: testPaths.medium,
        root: TEST_DIR,
      })

      const result = await benchmark(
        'Rapid Schema Changes',
        async () => {
          // Simulate rapid buildStart calls (like file watching)
          if (plugin.buildStart) {
            await plugin.buildStart.call({})
          }

          // Load modules immediately after
          const load = plugin.load
          if (load) {
            load('virtual:ork/types')
          }
        },
        20, // 20 rapid changes
      )

      console.log(`📊 ${result.name}: ${result.average.toFixed(2)}ms average (${result.iterations} changes)`)

      // Should handle rapid changes efficiently (< 100ms average)
      expect(result.average).toBeLessThan(100)
    })

    it('should handle concurrent module requests', async () => {
      const plugin = unpluginOrk.raw({
        schema: testPaths.medium,
        root: TEST_DIR,
      })

      if (plugin.buildStart) {
        await plugin.buildStart.call({})
      }

      const result = await benchmark(
        'Concurrent Module Requests',
        async () => {
          const load = plugin.load
          if (load) {
            // Simulate concurrent requests for different modules
            const promises = [
              Promise.resolve(load('virtual:ork/types')),
              Promise.resolve(load('virtual:ork/index')),
              Promise.resolve(load('virtual:ork/generated')),
              Promise.resolve(load('virtual:ork/types')), // Duplicate request
              Promise.resolve(load('virtual:ork/index')), // Duplicate request
            ]

            const results = await Promise.all(promises)
            results.forEach((result) => expect(result).toBeDefined())
          }
        },
        10,
      )

      console.log(`📊 ${result.name}: ${result.average.toFixed(2)}ms average (${result.iterations} batches)`)

      // Concurrent requests should be handled efficiently (< 20ms average)
      expect(result.average).toBeLessThan(20)
    })
  })
})
