import { NewPrismaClient } from '../../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  ({ provider }) => {
    describe('empty', () => {
      test('does not crash before client is connected', async () => {
        await expect(prisma.$metrics.prometheus()).resolves.not.toThrow()
      })
    })

    describe('with data', () => {
      beforeAll(async () => {
        const email = 'user@example.com'
        await prisma.user.create({
          data: {
            email,
          },
        })

        await prisma.user.findFirst({ where: { email } })
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
