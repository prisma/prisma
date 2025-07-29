import type { SqlDriverAdapterFactory } from '@prisma/driver-adapter-utils'

import { validateEngineInstanceConfig } from './validateEngineInstanceConfig'

/**
 * - `copyEngine === false` implies Prisma Accelerate usage
 * - If we detect Prisma Accelerate usage, we want to recommend using `--no-engine` in production.
 * - Driver Adapters should NOT be used with `prisma generate `--no-engine`
 * - Driver Adapters should NOT be imported from `@prisma/client/edge` endpoint
 * - Accelerate should NOT be used with Driver Adapters
 * - Prisma Postgres can be used exclusively with either Accelerate or Driver Adapters
 */

describe('validateEngineInstanceConfig', () => {
  const URLS = {
    accelerate: 'prisma://some-accelerate-usage.net',
    pgPlain: 'postgresql://some-plain-postgres.net',
    ppg: 'prisma+postgres://some-prisma-postgres.net',
    noUrl: undefined,
  }

  const mockAdapter = {
    adapterName: '@prisma/adapter-mock',
    provider: 'postgres',
    connect: () => {
      throw new Error('Not implemented')
    },
  } as SqlDriverAdapterFactory

  const targetBuildType = 'client' satisfies Parameters<typeof validateEngineInstanceConfig>[0]['targetBuildType']

  describe('detects what is being used based on the parameters', () => {
    test('detects Accelerate from URL', () => {
      const { ok, isUsing } = validateEngineInstanceConfig({
        url: URLS.accelerate,
        targetBuildType,
        copyEngine: false,
      })

      expectTrue(ok)
      expect(isUsing.accelerate).toBe(true)
      expect(isUsing.driverAdapters).toBe(false)
      expect(isUsing.ppg).toBe(false)
    })

    test('detects Accelerate from --no-engine', () => {
      const { ok, isUsing } = validateEngineInstanceConfig({
        url: URLS.pgPlain,
        targetBuildType,
        copyEngine: false,
      })

      expectTrue(ok)
      expect(isUsing.accelerate).toBe(true)
      expect(isUsing.driverAdapters).toBe(false)
      expect(isUsing.ppg).toBe(false)
    })

    test('detects Driver Adapters from adapter', () => {
      const { ok, isUsing } = validateEngineInstanceConfig({
        url: URLS.pgPlain,
        targetBuildType,
        adapter: mockAdapter,
        copyEngine: true,
      })

      expectTrue(ok)
      expect(isUsing.accelerate).toBe(false)
      expect(isUsing.driverAdapters).toBe(true)
      expect(isUsing.ppg).toBe(false)
    })

    test('detects Prisma Postgres from URL, which is also considered Accelerate', () => {
      const { ok, isUsing } = validateEngineInstanceConfig({
        url: URLS.ppg,
        targetBuildType,
        copyEngine: false,
      })

      expectTrue(ok)
      expect(isUsing.accelerate).toBe(true)
      expect(isUsing.driverAdapters).toBe(false)
      expect(isUsing.ppg).toBe(true)
    })
  })

  describe('using Prisma Accelerate', () => {
    const url = URLS.accelerate

    test('recommend using `--no-engine` if it was not run already', () => {
      const { ok, isUsing, diagnostics } = validateEngineInstanceConfig({
        url,
        targetBuildType,
        copyEngine: true,
      })

      expectTrue(ok)
      expect(diagnostics.errors).toBe(undefined)
      expect(diagnostics.warnings).toMatchInlineSnapshot(`
        [
          {
            "_tag": "warning",
            "value": [
              "recommend--no-engine",
              "In production, we recommend using \`prisma generate --no-engine\` (See: \`prisma generate --help\`)",
            ],
          },
        ]
      `)
      expect(isUsing.accelerate).toBe(true)
      expect(isUsing.driverAdapters).toBe(false)
      expect(isUsing.ppg).toBe(false)
    })

    test('do not recommend using `--no-engine` if it was run already', () => {
      const { ok, isUsing, diagnostics } = validateEngineInstanceConfig({
        url,
        targetBuildType,
        copyEngine: false,
      })

      expectTrue(ok)
      expect(diagnostics.errors).toBe(undefined)
      expect(diagnostics.warnings).toMatchInlineSnapshot(`[]`)
      expect(isUsing.accelerate).toBe(true)
      expect(isUsing.driverAdapters).toBe(false)
      expect(isUsing.ppg).toBe(false)
    })

    test('error when using Driver Adapters', () => {
      const { ok, isUsing, diagnostics } = validateEngineInstanceConfig({
        url,
        targetBuildType,
        copyEngine: true,
        adapter: mockAdapter,
      })

      if (!ok) {
        diagnostics.errors
      }

      expectFalse(ok)
      expect(diagnostics.errors).toHaveLength(1)
      expect(diagnostics.errors[0].value).toMatchInlineSnapshot(`
        "Prisma Client was configured to use the \`adapter\` option but the URL was a \`prisma://\` URL.
        Please either use the \`prisma://\` URL or remove the \`adapter\` from the Prisma Client constructor."
      `)
      expect(isUsing.accelerate).toBe(true)
      expect(isUsing.driverAdapters).toBe(true)
      expect(isUsing.ppg).toBe(false)
    })
  })

  describe('using Driver Adapters', () => {
    it('error when the target build type is `edge`', () => {
      const { ok, isUsing, diagnostics } = validateEngineInstanceConfig({
        url: URLS.pgPlain,
        targetBuildType: 'edge',
        copyEngine: true,
        adapter: mockAdapter,
      })

      expectFalse(ok)
      expect(diagnostics.errors).toHaveLength(1)
      expect(diagnostics.errors[0].value).toMatchInlineSnapshot(`
        "Prisma Client was configured to use the \`adapter\` option but it was imported via its \`/edge\` endpoint.
        Please either remove the \`/edge\` endpoint or remove the \`adapter\` from the Prisma Client constructor."
      `)
      expect(isUsing.accelerate).toBe(false)
      expect(isUsing.driverAdapters).toBe(true)
      expect(isUsing.ppg).toBe(false)
    })

    it('error when using `--no-engine`', () => {
      const { ok, isUsing, diagnostics } = validateEngineInstanceConfig({
        url: URLS.pgPlain,
        targetBuildType,
        copyEngine: false,
        adapter: mockAdapter,
      })

      expectFalse(ok)
      expect(diagnostics.errors).toHaveLength(1)
      expect(diagnostics.errors[0].value).toMatchInlineSnapshot(`
        "Prisma Client was configured to use the \`adapter\` option but \`prisma generate\` was run with \`--no-engine\`.
        Please run \`prisma generate\` without \`--no-engine\` to be able to use Prisma Client with the adapter."
      `)
      expect(isUsing.accelerate).toBe(true)
      expect(isUsing.driverAdapters).toBe(true)
      expect(isUsing.ppg).toBe(false)
    })

    it('works with Prisma Postgres', () => {
      const { ok, isUsing, diagnostics } = validateEngineInstanceConfig({
        url: URLS.ppg,
        targetBuildType,
        copyEngine: true,
        adapter: mockAdapter,
      })

      expectTrue(ok)
      expect(diagnostics.errors).toBe(undefined)
      expect(diagnostics.warnings).toMatchInlineSnapshot(`[]`)
      expect(isUsing.accelerate).toBe(true)
      expect(isUsing.driverAdapters).toBe(true)
      expect(isUsing.ppg).toBe(true)
    })
  })

  describe('using Prisma Postgres', () => {
    test('basic', () => {
      const { ok, isUsing, diagnostics } = validateEngineInstanceConfig({
        url: URLS.ppg,
        targetBuildType,
        copyEngine: false,
      })

      expectTrue(ok)
      expect(diagnostics.warnings).toMatchInlineSnapshot(`[]`)
      expect(diagnostics.errors).toBe(undefined)
      expect(isUsing.accelerate).toBe(true)
      expect(isUsing.driverAdapters).toBe(false)
      expect(isUsing.ppg).toBe(true)
    })

    test('recommend using `--no-engine` if it was not run already', () => {
      const { ok, isUsing, diagnostics } = validateEngineInstanceConfig({
        url: URLS.ppg,
        targetBuildType,
        copyEngine: true,
      })

      expectTrue(ok)
      expect(diagnostics.errors).toBe(undefined)
      expect(diagnostics.warnings).toMatchInlineSnapshot(`
        [
          {
            "_tag": "warning",
            "value": [
              "recommend--no-engine",
              "In production, we recommend using \`prisma generate --no-engine\` (See: \`prisma generate --help\`)",
            ],
          },
        ]
      `)
      expect(isUsing.accelerate).toBe(true)
      expect(isUsing.driverAdapters).toBe(false)
      expect(isUsing.ppg).toBe(true)
    })

    it('works with /edge endpoint', () => {
      const { ok, isUsing, diagnostics } = validateEngineInstanceConfig({
        url: URLS.ppg,
        targetBuildType: 'edge',
        copyEngine: false,
      })

      expectTrue(ok)
      expect(diagnostics.errors).toBe(undefined)
      expect(diagnostics.warnings).toMatchInlineSnapshot(`[]`)
      expect(isUsing.accelerate).toBe(true)
      expect(isUsing.driverAdapters).toBe(false)
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
