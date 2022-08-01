import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
type PrismaClient = import('@prisma/client').PrismaClient
declare let prisma: PrismaClient
// @ts-ignore this is just for type checks
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(({ provider }) => {
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

      expect(metrics).toContain('prisma_client_queries_total')
      expect(metrics).toContain('prisma_datasource_queries_total')
      expect(metrics).toContain('prisma_client_queries_active')
      expect(metrics).toContain('prisma_client_queries_duration_histogram_ms_bucket')

      if (provider !== 'mongodb') {
        expect(metrics).toContain('prisma_client_queries_wait_histogram_ms_bucket')
        expect(metrics).toContain('prisma_pool_connections_open')
        expect(metrics).toContain('prisma_pool_connections_idle')
        expect(metrics).toContain('prisma_client_queries_wait')
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

      expect(gauges.length).toBeGreaterThan(0)
      expect(gauges[0].value).toBeGreaterThanOrEqual(0)

      expect(histograms.length).toBeGreaterThan(0)
      expect(histograms[0].value.buckets.length).toBeGreaterThan(0)

      expect(histograms[0].value.count).toBeGreaterThan(0)
      expect(histograms[0].value.sum).toBeGreaterThan(0)

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

  describe('mutliple instances', () => {
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
})
