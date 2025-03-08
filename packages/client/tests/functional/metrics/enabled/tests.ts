import { Providers } from '../../_utils/providers'
import type { NewPrismaClient } from '../../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

const executeOneQuery = async () => {
  const email = 'user@example.com'
  await prisma.user.create({
    data: {
      email,
    },
  })
  await prisma.user.findFirst({ where: { email } })
}

testMatrix.setupTestSuite(
  ({ provider, driverAdapter }) => {
    const usesDriverAdapter = driverAdapter !== undefined
    describe('empty', () => {
      test('$metrics.prometheus() does not crash before client is connected', async () => {
        await expect(prisma.$metrics.prometheus()).resolves.not.toThrow()
      })
      test('$metrics.json() does not crash before client is connected', async () => {
        await expect(prisma.$metrics.json()).resolves.not.toThrow()
      })
    })

    describe('before a query', () => {
      test('MongoDB: should have the same keys, before and after a query', async () => {
        if (provider !== Providers.MONGODB) {
          return
        }

        const metricBefore = await prisma.$metrics.json()
        // console.log(JSON.stringify(metricBefore, null, 2))
        const { counters: countersBefore, gauges: gaugesBefore, histograms: histogramsBefore } = metricBefore
        expect(countersBefore.sort((a, b) => a.key.localeCompare(b.key))).toMatchObject([
          {
            key: 'prisma_client_queries_total',
            labels: {},
            value: 0,
            description: 'The total number of Prisma Client queries executed',
          },
          {
            key: 'prisma_datasource_queries_total',
            labels: {},
            value: 0,
            description: 'The total number of datasource queries executed',
          },
          {
            key: 'prisma_pool_connections_closed_total',
            labels: {},
            value: 0,
            description: 'The total number of pool connections closed',
          },
          {
            key: 'prisma_pool_connections_opened_total',
            labels: {},
            value: 0, // different from SQL providers
            description: 'The total number of pool connections opened',
          },
        ])
        expect(gaugesBefore.sort((a, b) => a.key.localeCompare(b.key))).toMatchObject([
          {
            key: 'prisma_client_queries_active',
            labels: {},
            value: 0,
            description: 'The number of currently active Prisma Client queries',
          },
          {
            key: 'prisma_client_queries_wait',
            labels: {},
            value: 0,
            description: 'The number of datasource queries currently waiting for a free connection',
          },
          {
            key: 'prisma_pool_connections_busy',
            labels: {},
            value: 0,
            description: 'The number of pool connections currently executing datasource queries',
          },
          {
            key: 'prisma_pool_connections_idle',
            labels: {},
            value: 0, // different from SQL providers
            description: 'The number of pool connections that are not busy running a query',
          },
          {
            key: 'prisma_pool_connections_open',
            labels: {},
            value: 0, // different from SQL providers
            description: 'The number of pool connections currently open',
          },
        ])
        expect(histogramsBefore).toEqual([])
        // Send 1 query
        await executeOneQuery()

        const metricAfter = await prisma.$metrics.json()
        // console.log(JSON.stringify(metricAfter, null, 2))
        const { counters: countersAfter, gauges: gaugesAfter, histograms: histogramsAfter } = metricAfter
        expect(countersAfter.sort((a, b) => a.key.localeCompare(b.key))).toMatchObject([
          {
            key: 'prisma_client_queries_total',
            labels: {},
            value: 2, // different from before
            description: 'The total number of Prisma Client queries executed',
          },
          {
            key: 'prisma_datasource_queries_total',
            labels: {},
            value: expect.any(Number), // different from before
            description: 'The total number of datasource queries executed',
          },
          {
            key: 'prisma_pool_connections_closed_total',
            labels: {},
            value: 0,
            description: 'The total number of pool connections closed',
          },
          {
            key: 'prisma_pool_connections_opened_total',
            labels: {},
            value: 0,
            description: 'The total number of pool connections opened',
          },
        ])
        expect(gaugesAfter.sort((a, b) => a.key.localeCompare(b.key))).toMatchObject([
          {
            key: 'prisma_client_queries_active',
            labels: {},
            value: 0,
            description: 'The number of currently active Prisma Client queries',
          },
          {
            key: 'prisma_client_queries_wait',
            labels: {},
            value: 0,
            description: 'The number of datasource queries currently waiting for a free connection',
          },
          {
            key: 'prisma_pool_connections_busy',
            labels: {},
            value: 0,
            description: 'The number of pool connections currently executing datasource queries',
          },
          {
            key: 'prisma_pool_connections_idle',
            labels: {},
            value: 0, // different from SQL providers
            description: 'The number of pool connections that are not busy running a query',
          },
          {
            key: 'prisma_pool_connections_open',
            labels: {},
            value: 0, // different from SQL providers
            description: 'The number of pool connections currently open',
          },
        ])
        expect(histogramsAfter.sort((a, b) => a.key.localeCompare(b.key))).toMatchObject([
          {
            key: 'prisma_client_queries_duration_histogram_ms',
            labels: {},
            value: {
              buckets: [
                [0, 0],
                [1, expect.any(Number)],
                [5, expect.any(Number)],
                [10, expect.any(Number)],
                [50, expect.any(Number)],
                [100, expect.any(Number)],
                [500, expect.any(Number)],
                [1000, expect.any(Number)],
                [5000, expect.any(Number)],
                [50000, expect.any(Number)],
              ],
              sum: expect.any(Number),
              count: expect.any(Number),
            },
            description: 'The distribution of the time Prisma Client queries took to run end to end',
          },
          {
            key: 'prisma_datasource_queries_duration_histogram_ms',
            labels: {},
            value: {
              buckets: [
                [0, expect.any(Number)],
                [1, expect.any(Number)],
                [5, expect.any(Number)],
                [10, expect.any(Number)],
                [50, expect.any(Number)],
                [100, expect.any(Number)],
                [500, expect.any(Number)],
                [1000, expect.any(Number)],
                [5000, expect.any(Number)],
                [50000, expect.any(Number)],
              ],
              sum: expect.any(Number),
              count: expect.any(Number),
            },
            description: 'The distribution of the time datasource queries took to run',
          },
        ])

        expect(countersBefore.length).toEqual(countersAfter.length)
        expect(gaugesBefore.length).toEqual(gaugesAfter.length)
        // TODO: this is currently failing
        // See https://github.com/prisma/prisma/issues/21070
        // expect(histogramsBefore.length).toEqual(histogramsAfter.length)
        // So we test the current behavior
        expect(histogramsBefore.length).toBeLessThan(histogramsAfter.length)
      })

      testIf(provider !== Providers.MONGODB)(
        'SQL Providers: should have the same keys, before and after a query',
        async () => {
          const metricBefore = await prisma.$metrics.json()
          // console.log(JSON.stringify(metricBefore, null, 2))
          const { counters: countersBefore, gauges: gaugesBefore, histograms: histogramsBefore } = metricBefore
          expect(countersBefore.sort((a, b) => a.key.localeCompare(b.key))).toMatchObject([
            {
              key: 'prisma_client_queries_total',
              labels: {},
              value: 0,
              description: 'The total number of Prisma Client queries executed',
            },
            {
              key: 'prisma_datasource_queries_total',
              labels: {},
              value: 0,
              description: 'The total number of datasource queries executed',
            },
            {
              key: 'prisma_pool_connections_closed_total',
              labels: {},
              value: 0,
              description: 'The total number of pool connections closed',
            },
            {
              key: 'prisma_pool_connections_opened_total',
              labels: {},
              value: usesDriverAdapter ? 0 : 1,
              description: 'The total number of pool connections opened',
            },
          ])
          expect(gaugesBefore.sort((a, b) => a.key.localeCompare(b.key))).toMatchObject([
            {
              key: 'prisma_client_queries_active',
              labels: {},
              value: 0,
              description: 'The number of currently active Prisma Client queries',
            },
            {
              key: 'prisma_client_queries_wait',
              labels: {},
              // Our test suite shows that the value can be one too few (=> -1) sometimes
              // Last seen in `Tests / Client func&legacy-notypes (4/5, library, 20, relationJoins)` run for SQLite, but also happens for other providers.
              // Tracking issue: https://github.com/prisma/team-orm/issues/1024
              value: expect.toBeOneOf([-1, 0]),
              description: 'The number of datasource queries currently waiting for a free connection',
            },
            {
              key: 'prisma_pool_connections_busy',
              labels: {},
              value: 0,
              description: 'The number of pool connections currently executing datasource queries',
            },
            {
              key: 'prisma_pool_connections_idle',
              labels: {},
              // This can sometimes be reported as 0, 1 or 2,
              // as metrics are reported asynchronously.
              // Note: We want to investigate why these different values are reported in our test setup
              // https://github.com/prisma/team-orm/issues/587
              value: expect.toBeOneOf([0, 1, 2]),
              description: 'The number of pool connections that are not busy running a query',
            },
            {
              key: 'prisma_pool_connections_open',
              labels: {},
              value: expect.any(Number), // usually the value is 1 but sometimes 0 on Windows CI
              description: 'The number of pool connections currently open',
            },
          ])

          if (!usesDriverAdapter) {
            expect(histogramsBefore.sort((a, b) => a.key.localeCompare(b.key))).toMatchObject([
              {
                key: 'prisma_client_queries_wait_histogram_ms',
                labels: {},
                value: {
                  buckets: [
                    [0, 0],
                    [1, 1],
                    [5, 0],
                    [10, 0],
                    [50, 0],
                    [100, 0],
                    [500, 0],
                    [1000, 0],
                    [5000, 0],
                    [50000, 0],
                  ],
                  sum: expect.any(Number),
                  count: 1,
                },
                description: 'The distribution of the time all datasource queries spent waiting for a free connection',
              },
            ])
          }

          // Send 1 query
          await executeOneQuery()

          const metricAfter = await prisma.$metrics.json()
          const { counters: countersAfter, gauges: gaugesAfter, histograms: histogramsAfter } = metricAfter
          expect(countersAfter.sort((a, b) => a.key.localeCompare(b.key))).toMatchObject([
            {
              key: 'prisma_client_queries_total',
              labels: {},
              value: 2, // different from before
              description: 'The total number of Prisma Client queries executed',
            },
            {
              key: 'prisma_datasource_queries_total',
              labels: {},
              value: expect.any(Number), // different from before
              description: 'The total number of datasource queries executed',
            },
            {
              key: 'prisma_pool_connections_closed_total',
              labels: {},
              value: 0,
              description: 'The total number of pool connections closed',
            },
            {
              key: 'prisma_pool_connections_opened_total',
              labels: {},
              value: expect.any(Number),
              description: 'The total number of pool connections opened',
            },
          ])
          expect(gaugesAfter.sort((a, b) => a.key.localeCompare(b.key))).toMatchObject([
            {
              key: 'prisma_client_queries_active',
              labels: {},
              value: 0,
              description: 'The number of currently active Prisma Client queries',
            },
            {
              key: 'prisma_client_queries_wait',
              labels: {},
              value: 0,
              description: 'The number of datasource queries currently waiting for a free connection',
            },
            {
              key: 'prisma_pool_connections_busy',
              labels: {},
              // This is either 0 or 1 at this point. We might want to use `waitFor` to wait for a stable
              // final state if we know the total number of connections.
              value: expect.toBeOneOf([0, 1]),
              description: 'The number of pool connections currently executing datasource queries',
            },
            {
              key: 'prisma_pool_connections_idle',
              labels: {},
              // This can sometimes be reported as 0, 1 or 2,
              // as metrics are reported asynchronously.
              // Note: We want to investigate why these different values are reported in our test setup
              // https://github.com/prisma/team-orm/issues/587
              value: expect.toBeOneOf([0, 1, 2]),
              description: 'The number of pool connections that are not busy running a query',
            },
            {
              key: 'prisma_pool_connections_open',
              labels: {},
              value: expect.any(Number),
              description: 'The number of pool connections currently open',
            },
          ])

          const expectedHistograms = [
            {
              key: 'prisma_client_queries_duration_histogram_ms',
              labels: {},
              value: {
                buckets: [
                  [0, 0],
                  [1, expect.any(Number)],
                  [5, expect.any(Number)],
                  [10, expect.any(Number)],
                  [50, expect.any(Number)],
                  [100, expect.any(Number)],
                  [500, expect.any(Number)],
                  [1000, expect.any(Number)],
                  [5000, expect.any(Number)],
                  [50000, expect.any(Number)],
                ],
                sum: expect.any(Number),
                count: expect.any(Number),
              },
              description: 'The distribution of the time Prisma Client queries took to run end to end',
            },
          ]

          if (!usesDriverAdapter) {
            expectedHistograms.push({
              key: 'prisma_client_queries_wait_histogram_ms',
              labels: {},
              value: {
                buckets: [
                  [0, 0],
                  [1, expect.any(Number)],
                  [5, expect.any(Number)],
                  [10, expect.any(Number)],
                  [50, expect.any(Number)],
                  [100, expect.any(Number)],
                  [500, expect.any(Number)],
                  [1000, expect.any(Number)],
                  [5000, expect.any(Number)],
                  [50000, expect.any(Number)],
                ],
                sum: expect.any(Number),
                count: expect.any(Number),
              },
              description: 'The distribution of the time all datasource queries spent waiting for a free connection',
            })
          }

          expectedHistograms.push({
            key: 'prisma_datasource_queries_duration_histogram_ms',
            labels: {},
            value: {
              buckets: [
                [0, 0],
                [1, expect.any(Number)],
                [5, expect.any(Number)],
                [10, expect.any(Number)],
                [50, expect.any(Number)],
                [100, expect.any(Number)],
                [500, expect.any(Number)],
                [1000, expect.any(Number)],
                [5000, expect.any(Number)],
                [50000, expect.any(Number)],
              ],
              sum: expect.any(Number),
              count: expect.any(Number),
            },
            description: 'The distribution of the time datasource queries took to run',
          })
          expect(histogramsAfter.sort((a, b) => a.key.localeCompare(b.key))).toMatchObject(expectedHistograms)

          expect(countersBefore.length).toEqual(countersAfter.length)
          expect(gaugesBefore.length).toEqual(gaugesAfter.length)
          // TODO: this is currently failing
          // See https://github.com/prisma/prisma/issues/21070
          // expect(histogramsBefore.length).toEqual(histogramsAfter.length)
          // So we test the current behavior
          expect(histogramsBefore.length).toBeLessThan(histogramsAfter.length)
        },
      )
    })

    describe('after a query', () => {
      beforeAll(async () => {
        await executeOneQuery()
      })

      // TODO test fails with Expected `11` but got `0` for key "/prisma_client_queries_wait_histogram_ms_bucket/g" See https://github.com/prisma/team-orm/issues/372
      test('returns metrics in prometheus format', async () => {
        const metrics = await prisma.$metrics.prometheus()
        expect((metrics.match(/prisma_client_queries_total \d/g) || []).length).toBe(1)
        expect((metrics.match(/prisma_client_queries_active \d/g) || []).length).toBe(1)

        // Our test suite shows that the value can be one too few (=> 0) sometimes
        // Last seen in `Tests / Client func&legacy-notypes (4/5, library, 20, relationJoins)` run for SQLite, but also happens for other providers.
        // Tracking issue: https://github.com/prisma/team-orm/issues/1024
        const prisma_client_queries_wait_length = (metrics.match(/prisma_client_queries_wait \d/g) || []).length
        expect(prisma_client_queries_wait_length === 0 || prisma_client_queries_wait_length === 1).toBe(true)

        expect((metrics.match(/prisma_client_queries_duration_histogram_ms_bucket/g) || []).length).toBe(11)
        expect((metrics.match(/prisma_client_queries_duration_histogram_ms_sum .*/g) || []).length).toBe(1)
        expect((metrics.match(/prisma_client_queries_duration_histogram_ms_count \d/g) || []).length).toBe(1)

        expect((metrics.match(/prisma_datasource_queries_total \d/g) || []).length).toBe(1)

        expect((metrics.match(/prisma_datasource_queries_duration_histogram_ms_bucket/g) || []).length).toBe(11)
        expect((metrics.match(/prisma_datasource_queries_duration_histogram_ms_sum .*/g) || []).length).toBe(1)
        expect((metrics.match(/prisma_datasource_queries_duration_histogram_ms_count \d/g) || []).length).toBe(1)

        expect((metrics.match(/prisma_pool_connections_busy \d/g) || []).length).toBe(1)
        expect((metrics.match(/prisma_pool_connections_open \d/g) || []).length).toBe(1)
        expect((metrics.match(/prisma_pool_connections_idle \d/g) || []).length).toBe(1)
        expect((metrics.match(/prisma_pool_connections_closed_total \d/g) || []).length).toBe(1)
        expect((metrics.match(/prisma_pool_connections_opened_total \d/g) || []).length).toBe(1)

        if (provider === Providers.MONGODB) {
          expect((metrics.match(/prisma_client_queries_wait_histogram_ms_bucket/g) || []).length).toBe(0)
          expect((metrics.match(/prisma_client_queries_wait_histogram_ms_sum .*/g) || []).length).toBe(0)
          expect((metrics.match(/prisma_client_queries_wait_histogram_ms_count \d/g) || []).length).toBe(0)
        } else if (!usesDriverAdapter) {
          // JS providers have no connection pool metrics
          expect((metrics.match(/prisma_client_queries_wait_histogram_ms_bucket/g) || []).length).toBe(11)
          expect((metrics.match(/prisma_client_queries_wait_histogram_ms_sum .*/g) || []).length).toBe(1)
          expect((metrics.match(/prisma_client_queries_wait_histogram_ms_count \d/g) || []).length).toBe(1)
        }
      })

      test('includes global labels in prometheus format', async () => {
        const metrics = await prisma.$metrics.prometheus({ globalLabels: { label1: 'value1', label2: 'value2' } })

        expect(metrics).toContain('{label1="value1",label2="value2"}')
      })

      test('returns metrics in json format', async () => {
        const { counters, gauges, histograms } = await prisma.$metrics.json()

        expect(counters.length).toBeGreaterThan(0)
        expect(counters[0].value).toBeGreaterThan(0)
        const counterKeys = counters.map((c) => c.key)
        expect(counterKeys).toEqual([
          'prisma_client_queries_total',
          'prisma_datasource_queries_total',
          'prisma_pool_connections_closed_total',
          'prisma_pool_connections_opened_total',
        ])

        expect(gauges.length).toBeGreaterThan(0)
        expect(gauges[0].value).toBeGreaterThanOrEqual(0)
        const gaugesKeys = gauges.map((c) => c.key)
        expect(gaugesKeys).toEqual([
          'prisma_client_queries_active',
          'prisma_client_queries_wait',
          'prisma_pool_connections_busy',
          'prisma_pool_connections_idle',
          'prisma_pool_connections_open',
        ])

        expect(histograms.length).toBeGreaterThan(0)
        expect(histograms[0].value.buckets.length).toBeGreaterThan(0)
        expect(histograms[0].value.count).toBeGreaterThan(0)
        expect(histograms[0].value.sum).toBeGreaterThan(0)
        const histogramsKeys = histograms.map((c) => c.key)
        if (provider === Providers.MONGODB || usesDriverAdapter) {
          // mongo and driver adapter don't use connection pool
          expect(histogramsKeys).toEqual([
            'prisma_client_queries_duration_histogram_ms',
            'prisma_datasource_queries_duration_histogram_ms',
          ])
        } else {
          expect(histogramsKeys).toEqual([
            'prisma_client_queries_duration_histogram_ms',
            'prisma_client_queries_wait_histogram_ms',
            'prisma_datasource_queries_duration_histogram_ms',
          ])
        }

        for (const [max, count] of histograms[0].value.buckets) {
          expect(max).toBeGreaterThanOrEqual(0)
          expect(count).toBeGreaterThanOrEqual(0)
        }
      })

      test('includes global labels in json format', async () => {
        const metrics = await prisma.$metrics.json({ globalLabels: { label1: 'value1', label2: 'value2' } })

        for (const counter of metrics.counters) {
          expect(counter.labels).toEqual({ label1: 'value1', label2: 'value2' })
        }

        for (const gauge of metrics.gauges) {
          expect(gauge.labels).toEqual({ label1: 'value1', label2: 'value2' })
        }

        for (const histogram of metrics.histograms) {
          expect(histogram.labels).toEqual({ label1: 'value1', label2: 'value2' })
        }
      })
    })

    describe('multiple instances', () => {
      test('does not share metrics between 2 different instances of client', async () => {
        const secondClient = newPrismaClient()
        await secondClient.user.create({
          data: {
            email: 'second-user@example.com',
          },
        })

        const metrics1 = await prisma.$metrics.json()
        const metrics2 = await secondClient.$metrics.json()

        expect(metrics1).not.toEqual(metrics2)
      })
    })
  },
  {
    skipDataProxy: {
      runtimes: ['node', 'edge'],
      reason: 'Metrics are not supported with Data Proxy yet',
    },
    skip(when, { clientRuntime }) {
      when(clientRuntime === 'wasm', 'Metrics are not supported with WASM engine yet')
    },
  },
)
