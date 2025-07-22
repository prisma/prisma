import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { $ } from 'zx'

describe('diagnostics related to prisma.config.ts should not influence structured output commands', () => {
  beforeEach(() => {
    // To hide "Update available 0.0.0 -> x.x.x"
    vi.stubEnv('PRISMA_HIDE_UPDATE_MESSAGE', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('prisma migrate diff --script', async () => {
    const { stdout, stderr, exitCode } =
      await $`pnpm prisma migrate diff --from-empty --to-schema-datamodel ./prisma/schema.prisma --script`
    expect(exitCode).toBe(0)
    expect(stdout).toMatchInlineSnapshot(`
      "-- CreateTable
      CREATE TABLE "User" (
          "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          "email" TEXT NOT NULL
      );

      -- CreateIndex
      CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

      "
    `)
    expect(stderr).toMatchInlineSnapshot(`
      "warn The configuration property \`package.json#prisma\` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., \`prisma.config.ts\`).
      For more information, see: https://pris.ly/prisma-config

      Loaded Prisma config from prisma.config.ts.

      warn The Prisma config file in prisma.config.ts overrides the deprecated \`package.json#prisma\` property in package.json.
        For more information, see: https://pris.ly/prisma-config

      "
    `)
  })

  test('prisma version --json', async () => {
    const { stdout, stderr, exitCode } = await $`pnpm prisma version --json`

    expect(exitCode).toBe(0)
    // TODO: uncomment when https://linear.app/prisma-company/issue/ORM-1257/fix-27005-which-is-similar-to-27638 is solved.
    expect(() => JSON.parse(stdout)) /* .not */
      .toThrow()
    expect(stderr).toMatchInlineSnapshot(`
      "warn The configuration property \`package.json#prisma\` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., \`prisma.config.ts\`).
      For more information, see: https://pris.ly/prisma-config

      Loaded Prisma config from prisma.config.ts.

      warn The Prisma config file in prisma.config.ts overrides the deprecated \`package.json#prisma\` property in package.json.
        For more information, see: https://pris.ly/prisma-config

      Prisma config detected, skipping environment variable loading.
      "
    `)
  })
})
