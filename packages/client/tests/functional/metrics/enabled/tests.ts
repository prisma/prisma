import { NewPrismaClient } from '../../_utils/types'
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
  ({ provider }) => {
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
        if (provider !== 'mongodb') {
          return
        }

        const metricBefore = await prisma.$metrics.json()
        // console.log(JSON.stringify(metricBefore, null, 2))
        expect(metricBefore).toMatchObject({
          counters: [
            {
              key: 'prisma_client_queries_total',
              labels: {},
              value: 0,
              description: 'Total number of Prisma Client queries executed',
            },
            {
              key: 'prisma_datasource_queries_total',
              labels: {},
              value: 0,
              description: 'Total number of Datasource Queries executed',
            },
            {
              key: 'prisma_pool_connections_closed_total',
              labels: {},
              value: 0,
              description: '',
              // description: 'Total number of Pool Connections closed',
            },
            {
              key: 'prisma_pool_connections_opened_total',
              labels: {},
              value: 0, // different from SQL providers
              description: '',
              // description: 'Total number of Pool Connections opened',
            },
          ],
          gauges: [
            {
              key: 'prisma_client_queries_active',
              labels: {},
              value: 0,
              // description: '',
              description: 'Number of currently active Prisma Client queries',
            },
            // {
            //   key: 'prisma_client_queries_wait',
            //   labels: {},
            //   value: 0,
            //   description: '',
            //   description: 'Number of queries currently waiting for a connection',
            // },
            {
              key: 'prisma_pool_connections_busy',
              labels: {},
              value: 0,
              description: '',
              // description: 'Number of currently busy Pool Connections (executing a database query)',
            },
            {
              key: 'prisma_pool_connections_idle',
              labels: {},
              value: 0, // different from SQL providers
              description: '',
              // description: 'Number of currently unused Pool Connections (waiting for the next pool query to run)',
            },
            {
              key: 'prisma_pool_connections_open',
              labels: {},
              value: 0, // different from SQL providers
              description: '',
              // description: 'Number of currently open Pool Connections',
            },
          ],
          histograms: [], // there are no histograms for MongoDB?
        })
        const { counters: countersBefore, gauges: gaugesBefore, histograms: histogramsBefore } = metricBefore

        // Send 1 query
        await executeOneQuery()

        const metricAfter = await prisma.$metrics.json()
        // console.log(JSON.stringify(metricAfter, null, 2))
        expect(metricAfter).toMatchObject({
          counters: [
            {
              key: 'prisma_client_queries_total',
              labels: {},
              value: 2, // different from before
              description: 'Total number of Prisma Client queries executed',
            },
            {
              key: 'prisma_datasource_queries_total',
              labels: {},
              value: expect.any(Number), // different from before
              description: 'Total number of Datasource Queries executed',
            },
            {
              key: 'prisma_pool_connections_closed_total',
              labels: {},
              value: 0,
              description: '',
              // description: 'Total number of Pool Connections closed',
            },
            {
              key: 'prisma_pool_connections_opened_total',
              labels: {},
              value: 0,
              description: '',
              // description: 'Total number of Pool Connections opened',
            },
          ],
          gauges: [
            {
              key: 'prisma_client_queries_active',
              labels: {},
              value: 0,
              description: 'Number of currently active Prisma Client queries',
            },
            // {
            //   key: 'prisma_client_queries_wait',
            //   labels: {},
            //   value: 0,
            //   description: 'Number of queries currently waiting for a connection',
            // },
            {
              key: 'prisma_pool_connections_busy',
              labels: {},
              value: 0,
              description: '',
              // description: 'Number of currently busy Pool Connections (executing a database query)',
            },
            {
              key: 'prisma_pool_connections_idle',
              labels: {},
              value: 0, // different from SQL providers
              description: '',
              // description: 'Number of currently unused Pool Connections (waiting for the next pool query to run)',
            },
            {
              key: 'prisma_pool_connections_open',
              labels: {},
              value: 0, // different from SQL providers
              description: '',
              // description: 'Number of currently open Pool Connections',
            },
          ],
          histograms: [
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
                  [100, 0],
                  [500, 0],
                  [1000, 0],
                  [5000, 0],
                  [50000, 0],
                ],
                sum: expect.any(Number),
                count: expect.any(Number),
              },
              description: 'Histogram of the duration of all executed Prisma Client queries in ms',
            },
            {
              key: 'prisma_datasource_queries_duration_histogram_ms',
              labels: {},
              value: {
                buckets: [
                  [0, 2],
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
              description: 'Histogram of the duration of all executed Datasource Queries in ms',
            },
          ],
        })

        const { counters: countersAfter, gauges: gaugesAfter, histograms: histogramsAfter } = metricAfter

        expect(countersBefore.length).toEqual(countersAfter.length)
        expect(gaugesBefore.length).toEqual(gaugesAfter.length)
        // TODO: this is currently failing
        // See https://github.com/prisma/prisma/issues/21070
        // expect(histogramsBefore.length).toEqual(histogramsAfter.length)
        // So we test the current behavior
        expect(histogramsBefore.length).toBeLessThan(histogramsAfter.length)
      })
      test('SQL Providers: should have the same keys, before and after a query', async () => {
        if (provider === 'mongodb') {
          return
        }

        const metricBefore = await prisma.$metrics.json()
        // console.log(JSON.stringify(metricBefore, null, 2))
        expect(metricBefore).toMatchObject({
          counters: [
            {
              key: 'prisma_client_queries_total',
              labels: {},
              value: 0,
              description: 'Total number of Prisma Client queries executed',
            },
            {
              key: 'prisma_datasource_queries_total',
              labels: {},
              value: 0,
              description: 'Total number of Datasource Queries executed',
            },
            {
              key: 'prisma_pool_connections_closed_total',
              labels: {},
              value: 0,
              description: 'Total number of Pool Connections closed',
            },
            {
              key: 'prisma_pool_connections_opened_total',
              labels: {},
              value: 1,
              description: 'Total number of Pool Connections opened',
            },
          ],
          gauges: [
            {
              key: 'prisma_client_queries_active',
              labels: {},
              value: 0,
              description: 'Number of currently active Prisma Client queries',
            },
            {
              key: 'prisma_client_queries_wait',
              labels: {},
              value: 0,
              description: 'Number of queries currently waiting for a connection',
            },
            {
              key: 'prisma_pool_connections_busy',
              labels: {},
              value: 0,
              description: 'Number of currently busy Pool Connections (executing a database query)',
            },
            {
              key: 'prisma_pool_connections_idle',
              labels: {},
              value: expect.any(Number),
              description: 'Number of currently unused Pool Connections (waiting for the next pool query to run)',
            },
            {
              key: 'prisma_pool_connections_open',
              labels: {},
              value: 1,
              description: 'Number of currently open Pool Connections',
            },
          ],
          histograms: [
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
              description: 'Histogram of the wait time of all queries in ms',
            },
          ],
        })
        const { counters: countersBefore, gauges: gaugesBefore, histograms: histogramsBefore } = metricBefore

        // Send 1 query
        await executeOneQuery()

        const metricAfter = await prisma.$metrics.json()
        // console.log(JSON.stringify(metricAfter, null, 2))
        // similar as metricBefore
        // main difference is +2 histograms
        expect(metricAfter).toMatchObject({
          counters: [
            {
              key: 'prisma_client_queries_total',
              labels: {},
              value: 2, // different from before
              description: 'Total number of Prisma Client queries executed',
            },
            {
              key: 'prisma_datasource_queries_total',
              labels: {},
              value: expect.any(Number), // different from before
              description: 'Total number of Datasource Queries executed',
            },
            {
              key: 'prisma_pool_connections_closed_total',
              labels: {},
              value: 0,
              description: 'Total number of Pool Connections closed',
            },
            {
              key: 'prisma_pool_connections_opened_total',
              labels: {},
              value: expect.any(Number),
              description: 'Total number of Pool Connections opened',
            },
          ],
          gauges: [
            {
              key: 'prisma_client_queries_active',
              labels: {},
              value: 0,
              description: 'Number of currently active Prisma Client queries',
            },
            {
              key: 'prisma_client_queries_wait',
              labels: {},
              value: 0,
              description: 'Number of queries currently waiting for a connection',
            },
            {
              key: 'prisma_pool_connections_busy',
              labels: {},
              value: 0,
              description: 'Number of currently busy Pool Connections (executing a database query)',
            },
            {
              key: 'prisma_pool_connections_idle',
              labels: {},
              value: expect.any(Number),
              description: 'Number of currently unused Pool Connections (waiting for the next pool query to run)',
            },
            {
              key: 'prisma_pool_connections_open',
              labels: {},
              value: expect.any(Number),
              description: 'Number of currently open Pool Connections',
            },
          ],
          histograms: [
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
                  [100, 0],
                  [500, 0],
                  [1000, 0],
                  [5000, 0],
                  [50000, 0],
                ],
                sum: expect.any(Number),
                count: expect.any(Number),
              },
              description: 'Histogram of the duration of all executed Prisma Client queries in ms',
            },
            {
              key: 'prisma_client_queries_wait_histogram_ms',
              labels: {},
              value: {
                buckets: [
                  [0, 0],
                  [1, expect.any(Number)],
                  [5, expect.any(Number)],
                  [10, expect.any(Number)],
                  [50, expect.any(Number)],
                  [100, 0],
                  [500, 0],
                  [1000, 0],
                  [5000, 0],
                  [50000, 0],
                ],
                sum: expect.any(Number),
                count: expect.any(Number),
              },
              description: 'Histogram of the wait time of all queries in ms',
            },
            {
              key: 'prisma_datasource_queries_duration_histogram_ms',
              labels: {},
              value: {
                buckets: [
                  [0, 0],
                  [1, expect.any(Number)],
                  [5, expect.any(Number)],
                  [10, expect.any(Number)],
                  [50, expect.any(Number)],
                  [100, 0],
                  [500, 0],
                  [1000, 0],
                  [5000, 0],
                  [50000, 0],
                ],
                sum: expect.any(Number),
                count: expect.any(Number),
              },
              description: 'Histogram of the duration of all executed Datasource Queries in ms',
            },
          ],
        })

        const { counters: countersAfter, gauges: gaugesAfter, histograms: histogramsAfter } = metricAfter

        expect(countersBefore.length).toEqual(countersAfter.length)
        expect(gaugesBefore.length).toEqual(gaugesAfter.length)
        // TODO: this is currently failing
        // See https://github.com/prisma/prisma/issues/21070
        // expect(histogramsBefore.length).toEqual(histogramsAfter.length)
        // So we test the current behavior
        expect(histogramsBefore.length).toBeLessThan(histogramsAfter.length)
      })
    })

    describe('after a query', () => {
      beforeAll(async () => {
        await executeOneQuery()
      })

      test('returns metrics in prometheus format', async () => {
        const metrics = await prisma.$metrics.prometheus()

        expect((metrics.match(/prisma_client_queries_total \d/g) || []).length).toBe(1)
        expect((metrics.match(/prisma_client_queries_active \d/g) || []).length).toBe(1)
        expect((metrics.match(/prisma_client_queries_duration_histogram_ms_bucket/g) || []).length).toBe(11)
        expect((metrics.match(/prisma_client_queries_duration_histogram_ms_sum .*/g) || []).length).toBe(1)
        expect((metrics.match(/prisma_client_queries_duration_histogram_ms_count \d/g) || []).length).toBe(1)

        expect((metrics.match(/prisma_datasource_queries_total \d/g) || []).length).toBe(1)

        expect((metrics.match(/prisma_datasource_queries_duration_histogram_ms_bucket/g) || []).length).toBe(11)
        expect((metrics.match(/prisma_datasource_queries_duration_histogram_ms_sum .*/g) || []).length).toBe(1)
        expect((metrics.match(/prisma_datasource_queries_duration_histogram_ms_count \d/g) || []).length).toBe(1)

        expect((metrics.match(/prisma_pool_connections_closed_total \d/g) || []).length).toBe(1)
        expect((metrics.match(/prisma_pool_connections_opened_total \d/g) || []).length).toBe(1)
        expect((metrics.match(/prisma_pool_connections_busy \d/g) || []).length).toBe(1)

        if (provider !== 'mongodb') {
          expect((metrics.match(/prisma_client_queries_wait \d/g) || []).length).toBe(1)
          expect((metrics.match(/prisma_client_queries_wait_histogram_ms_bucket/g) || []).length).toBe(11)
          expect((metrics.match(/prisma_client_queries_wait_histogram_ms_sum .*/g) || []).length).toBe(1)
          expect((metrics.match(/prisma_client_queries_wait_histogram_ms_count \d/g) || []).length).toBe(1)

          expect((metrics.match(/prisma_pool_connections_open \d/g) || []).length).toBe(1)
          expect((metrics.match(/prisma_pool_connections_idle \d/g) || []).length).toBe(1)
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
        if (provider === 'mongodb') {
          expect(gaugesKeys).toEqual([
            'prisma_client_queries_active',
            // 'prisma_client_queries_wait',
            'prisma_pool_connections_busy',
            'prisma_pool_connections_idle',
            'prisma_pool_connections_open',
          ])
        } else {
          expect(gaugesKeys).toEqual([
            'prisma_client_queries_active',
            'prisma_client_queries_wait',
            'prisma_pool_connections_busy',
            'prisma_pool_connections_idle',
            'prisma_pool_connections_open',
          ])
        }

        expect(histograms.length).toBeGreaterThan(0)
        expect(histograms[0].value.buckets.length).toBeGreaterThan(0)
        expect(histograms[0].value.count).toBeGreaterThan(0)
        expect(histograms[0].value.sum).toBeGreaterThan(0)
        const histogramsKeys = histograms.map((c) => c.key)
        if (provider === 'mongodb') {
          expect(histogramsKeys).toEqual([
            'prisma_client_queries_duration_histogram_ms',
            // 'prisma_client_queries_wait_histogram_ms',
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
  },
)
