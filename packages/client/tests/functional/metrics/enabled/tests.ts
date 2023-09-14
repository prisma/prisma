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
      // TODO: this is currently failing
      // See https://github.com/prisma/prisma/issues/21070
      test.failing('should have the same keys, before and after a query', async () => {
        const metricBefore = await prisma.$metrics.json()
        // console.log(JSON.stringify(metricBefore, null, 2))
        expect(metricBefore).toMatchObject({
          counters: [{}, {}, {}, {}, {}],
          gauges: [{}, {}, {}, {}, {}, {}, {}, {}, {}],
          histograms: [{}],
        })
        const { counters: countersBefore, gauges: gaugesBefore, histograms: histogramsBefore } = metricBefore

        // Send 1 query
        await executeOneQuery()

        const metricAfter = await prisma.$metrics.json()
        // console.log(JSON.stringify(metricAfter, null, 2))
        // similar as metricBefore
        // only difference is +2 histograms
        expect(metricAfter).toMatchObject({
          counters: [{}, {}, {}, {}, {}],
          gauges: [{}, {}, {}, {}, {}, {}, {}, {}, {}],
          histograms: [{}, {}, {}],
        })

        const { counters: countersAfter, gauges: gaugesAfter, histograms: histogramsAfter } = metricAfter

        expect(countersBefore.length).toEqual(countersAfter.length)
        expect(gaugesBefore.length).toEqual(gaugesAfter.length)
        expect(histogramsBefore.length).toEqual(histogramsAfter.length)
      })
    })

    describe('after a query', () => {
      beforeAll(async () => {
        await executeOneQuery()
      })

      test.failing('returns metrics in prometheus format', async () => {
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

      test.failing('returns metrics in json format', async () => {
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
        expect(histogramsKeys).toEqual([
          'prisma_client_queries_duration_histogram_ms',
          'prisma_client_queries_wait_histogram_ms',
          'prisma_datasource_queries_duration_histogram_ms',
        ])

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
