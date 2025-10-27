import type { SqlDriverAdapterFactory } from '@prisma/driver-adapter-utils'

import { validateEngineInstanceConfig } from './validateEngineInstanceConfig'

/**
 * - Accelerate should NOT be used with Driver Adapters
 * - Prisma Postgres can be used exclusively with either Accelerate or Driver Adapters
 */

describe('validateEngineInstanceConfig', () => {
  const URLS = {
    accelerate: 'prisma://some-accelerate-usage.net',
    pgPlain: 'postgresql://some-plain-postgres.net',
    ppg: 'prisma+postgres://some-prisma-postgres.net',
    ppgDirectTCP: 'postgres://user:pass@db.prisma.io:5432/postgres?sslmode=require',
    noUrl: undefined,
  }

  const mockAdapter = {
    adapterName: '@prisma/adapter-mock',
    provider: 'postgres',
    connect: () => {
      throw new Error('Not implemented')
    },
  } as SqlDriverAdapterFactory

  describe('detects what is being used based on the parameters', () => {
    test('detects Accelerate from URL', () => {
      const { ok, isUsing } = validateEngineInstanceConfig({
        url: URLS.accelerate,
      })

      expectTrue(ok)
      expect(isUsing.accelerate).toBe(true)
      expect(isUsing.driverAdapters).toBe(false)
      expect(isUsing.ppg).toBe(false)
    })

    test('detects Driver Adapters from adapter', () => {
      const { ok, isUsing } = validateEngineInstanceConfig({
        url: URLS.pgPlain,
        adapter: mockAdapter,
      })

      expectTrue(ok)
      expect(isUsing.accelerate).toBe(false)
      expect(isUsing.driverAdapters).toBe(true)
      expect(isUsing.ppg).toBe(false)
    })

    test('detects Prisma Postgres from URL, which is also considered Accelerate', () => {
      const { ok, isUsing } = validateEngineInstanceConfig({
        url: URLS.ppg,
      })

      expectTrue(ok)
      expect(isUsing.accelerate).toBe(true)
      expect(isUsing.driverAdapters).toBe(false)
      expect(isUsing.ppg).toBe(true)
    })
  })

  describe('using Prisma Accelerate', () => {
    const url = URLS.accelerate

    test('error when using Driver Adapters', () => {
      const { ok, isUsing, diagnostics } = validateEngineInstanceConfig({
        url,
        adapter: mockAdapter,
      })

      if (!ok) {
        diagnostics.errors
      }

      expectFalse(ok)
      expect(diagnostics.errors).toHaveLength(1)
      expect(diagnostics.errors[0].value).toMatchInlineSnapshot(`
        "You've provided both a driver adapter and an Accelerate database URL. Driver adapters currently cannot connect to Accelerate.
        Please provide either a driver adapter with a direct database URL or an Accelerate URL and no driver adapter."
      `)
      expect(isUsing.accelerate).toBe(true)
      expect(isUsing.driverAdapters).toBe(true)
      expect(isUsing.ppg).toBe(false)
    })
  })

  describe('using Driver Adapters', () => {
    it('works with Prisma Postgres direct TCP', () => {
      const { ok, isUsing, diagnostics } = validateEngineInstanceConfig({
        url: URLS.ppgDirectTCP,
        adapter: mockAdapter,
      })

      expectTrue(ok)
      expect(diagnostics.errors).toBe(undefined)
      expect(diagnostics.warnings).toMatchInlineSnapshot(`[]`)
      expect(isUsing.accelerate).toBe(false)
      expect(isUsing.driverAdapters).toBe(true)
      expect(isUsing.ppg).toBe(false)
    })
  })

  describe('using Prisma Postgres', () => {
    test('basic', () => {
      const { ok, isUsing, diagnostics } = validateEngineInstanceConfig({
        url: URLS.ppg,
      })

      expectTrue(ok)
      expect(diagnostics.warnings).toMatchInlineSnapshot(`[]`)
      expect(diagnostics.errors).toBe(undefined)
      expect(isUsing.accelerate).toBe(true)
      expect(isUsing.driverAdapters).toBe(false)
      expect(isUsing.ppg).toBe(true)
    })

    test('error when using Driver Adapters', () => {
      const { ok, isUsing, diagnostics } = validateEngineInstanceConfig({
        url: URLS.ppg,
        adapter: mockAdapter,
      })

      if (!ok) {
        diagnostics.errors
      }

      expectFalse(ok)
      expect(diagnostics.errors).toHaveLength(1)
      expect(diagnostics.errors[0].value).toMatchInlineSnapshot(`
        "You've provided both a driver adapter and an Accelerate database URL. Driver adapters currently cannot connect to Accelerate.
        Please provide either a driver adapter with a direct database URL or an Accelerate URL and no driver adapter."
      `)
      expect(isUsing.accelerate).toBe(true)
      expect(isUsing.driverAdapters).toBe(true)
      expect(isUsing.ppg).toBe(true)
    })
  })
})

/**
 * Type assertion helpers, useful to narrow down types.
 */

function expectTrue(ok: boolean): asserts ok is true {
  expect(ok).toBe(true)
}

function expectFalse(ok: boolean): asserts ok is false {
  expect(ok).toBe(false)
}
