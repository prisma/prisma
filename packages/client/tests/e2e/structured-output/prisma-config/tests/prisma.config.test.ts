import { describe, expect, test } from 'vitest'
import { $ } from 'zx'

describe('diagnostics related to prisma.config.ts should not influence structured output commands', () => {
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

      Prisma config loaded from prisma.config.ts.

      warn The Prisma config file in prisma.config.ts overrides the deprecated \`package.json#prisma\` property in package.json.
        For more information, see: https://pris.ly/prisma-config

      "
    `)
  })

  test('prisma version --json', async () => {
    const { stdout, stderr, exitCode } = await $`pnpm prisma version --json`
    expect(exitCode).toBe(0)
    expect(stdout).toMatchInlineSnapshot(`
      "{
        "prisma": "0.0.0",
        "@prisma/client": "0.0.0",
        "computed-binarytarget": "darwin-arm64",
        "operating-system": "darwin",
        "architecture": "arm64",
        "node.js": "v20.19.0",
        "typescript": "5.4.5",
        "query-engine-(node-api)": "libquery-engine 77fb9809e430b5a7c3dece3d5d609dc5d4e2358d (at ../../packages/engines/libquery_engine-darwin-arm64.dylib.node)",
        "psl": "@prisma/prisma-schema-wasm 6.13.0-18.77fb9809e430b5a7c3dece3d5d609dc5d4e2358d",
        "schema-engine": "schema-engine-cli 77fb9809e430b5a7c3dece3d5d609dc5d4e2358d (at ../../packages/engines/schema-engine-darwin-arm64)",
        "default-engines-hash": "77fb9809e430b5a7c3dece3d5d609dc5d4e2358d",
        "studio": "0.511.0"
      }
      "
    `)
    expect(() => JSON.parse(stdout)).not.toThrow()
    expect(stderr).toMatchInlineSnapshot(`
      "warn The configuration property \`package.json#prisma\` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., \`prisma.config.ts\`).
      For more information, see: https://pris.ly/prisma-config

      Prisma config loaded from prisma.config.ts.

      warn The Prisma config file in prisma.config.ts overrides the deprecated \`package.json#prisma\` property in package.json.
        For more information, see: https://pris.ly/prisma-config

      Prisma config detected, skipping environment variable loading.
      Prisma schema loaded from prisma/schema.prisma
      "
    `)
  })
})
