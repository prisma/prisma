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

      "
    `)
  })

  test('prisma version --json', async () => {
    const { stdout, stderr, exitCode } = await $`pnpm prisma version --json`
    expect(exitCode).toBe(0)
    expect(stdout).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      {
        "prisma": "0.0.0",
        "@prisma/client": "Not found",
        "computed-binarytarget": "linux-arm64-openssl-3.0.x",
        "operating-system": "linux",
        "architecture": "arm64",
        "node.js": "v18.20.8",
        "typescript": "unknown",
        "query-engine-(node-api)": "libquery-engine 77fb9809e430b5a7c3dece3d5d609dc5d4e2358d (at node_modules/.pnpm/@prisma+engines@file+..+..+..+tmp+prisma-engines-0.0.0.tgz/node_modules/@prisma/engines/libquery_engine-linux-arm64-openssl-3.0.x.so.node)",
        "psl": "@prisma/prisma-schema-wasm 6.13.0-18.77fb9809e430b5a7c3dece3d5d609dc5d4e2358d",
        "schema-engine": "schema-engine-cli 77fb9809e430b5a7c3dece3d5d609dc5d4e2358d (at node_modules/.pnpm/@prisma+engines@file+..+..+..+tmp+prisma-engines-0.0.0.tgz/node_modules/@prisma/engines/schema-engine-linux-arm64-openssl-3.0.x)",
        "default-engines-hash": "77fb9809e430b5a7c3dece3d5d609dc5d4e2358d",
        "studio": "0.511.0"
      }
      "
    `)
    // TODO: uncomment when https://linear.app/prisma-company/issue/ORM-1257/fix-27005-which-is-similar-to-27638 is solved.
    expect(() => JSON.parse(stdout)) /* .not */
      .toThrow()
    expect(stderr).toMatchInlineSnapshot(`
      "warn The configuration property \`package.json#prisma\` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., \`prisma.config.ts\`).
      For more information, see: https://pris.ly/prisma-config

      "
    `)
  })
})
