// @ts-ignore
import { enginesVersion } from '@prisma/engines'
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

      "
    `)
  })

  test('prisma version --json', async () => {
    const { stdout, stderr, exitCode } = await $`pnpm prisma version --json`
    const cleanStdout = cleanVersionSnapshot(stdout)

    expect(exitCode).toBe(0)
    expect(cleanStdout).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      {
        "prisma": "0.0.0",
        "@prisma/client": "Not found",
        "computed-binarytarget": "debian-openssl-3.0.x",
        "operating-system": "OS",
        "architecture": "ARCHITECTURE",
        "node.js": "NODEJS_VERSION",
        "typescript": "unknown",
        "query-engine-(node-api)": "libquery-engine ENGINE_VERSION (at sanitized_path/libquery_engine-debian-openssl-3.0.x.so.node)",
        "psl": "@prisma/prisma-schema-wasm CLI_VERSION.ENGINE_VERSION",
        "schema-engine": "schema-engine-cli ENGINE_VERSION (at sanitized_path/schema-engine-debian-openssl-3.0.x)",
        "default-engines-hash": "ENGINE_VERSION",
        "studio": "0.511.0"
      }
      "
    `)
    // TODO: uncomment when https://linear.app/prisma-company/issue/ORM-1257/fix-27005-which-is-similar-to-27638 is solved.
    expect(() => JSON.parse(cleanStdout)) /* .not */
      .toThrow()
    expect(stderr).toMatchInlineSnapshot(`
      "warn The configuration property \`package.json#prisma\` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., \`prisma.config.ts\`).
      For more information, see: https://pris.ly/prisma-config

      "
    `)
  })
})

function cleanVersionSnapshot(str: string, versionOverride?: string): string {
  // sanitize engine path
  // Query Engine (Node-API) : libquery-engine e996df5d66a2314d1da15d31047f9777fc2fbdd9 (at ../../home/runner/work/prisma/prisma/node_modules/.pnpm/@prisma+engines@3.11.0-41.e996df5d66a2314d1da15d31047f9777fc2fbdd9/node_modules/@prisma/engines/libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node)
  // +                                                                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  // Query Engine (Node-API) : libquery-engine 5a2e5869b69a983e279380ec68596b71beae9eff (at ../../cli/src/__tests__/commands/version-test-engines/libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node, resolved by PRISMA_QUERY_ENGINE_LIBRARY)
  // =>                                                                                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  // Query Engine (Node-API) : libquery-engine e996df5d66a2314d1da15d31047f9777fc2fbdd9 (at sanitized_path/libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node)
  //                                                                                    ^^^^^^^^^^^^^^^^^^^
  str = str.replace(/\(at (.*engines)(\/|\\)/g, '(at sanitized_path/')

  // Replace 'Loaded Prisma config from "/.../prisma.config.ts"'
  // with 'Loaded Prisma config from "sanitized prisma.config.ts path"'
  str = str.replace(
    /Loaded Prisma config from ".*(\/|\\)prisma\.config\.ts"/g,
    'Loaded Prisma config from "sanitized prisma.config.ts path"',
  )

  // TODO: replace '[a-z0-9]{40}' with 'ENGINE_VERSION'.
  // Currently, the engine version of @prisma/prisma-schema-wasm isn't necessarily the same as the enginesVersion
  str = str.replace(/([0-9]+\.[0-9]+\.[0-9]+-[0-9]+\.)([a-z0-9-]+)/g, 'CLI_VERSION.ENGINE_VERSION')

  // Replace locally built prisma-schema-wasm and schema-engine-wasm versions linked via package.json
  str = str.replace(/link:([A-Z]:)?(\/[\w-]+)+/g, 'CLI_VERSION.ENGINE_VERSION')

  // replace engine version hash
  const defaultEngineVersion = enginesVersion
  const currentEngineVersion = versionOverride ?? enginesVersion
  str = str.replace(new RegExp(currentEngineVersion, 'g'), 'ENGINE_VERSION')
  str = str.replace(new RegExp(defaultEngineVersion, 'g'), 'ENGINE_VERSION')
  str = str.replace(new RegExp('(operating-system\\s+:).*', 'g'), '$1 OS')
  str = str.replace(new RegExp('(architecture\\s+:).*', 'g'), '$1 ARCHITECTURE')
  str = str.replace(new RegExp('workspace:\\*', 'g'), 'ENGINE_VERSION')
  str = str.replace(new RegExp(process.version, 'g'), 'NODEJS_VERSION')
  str = str.replace(new RegExp(`(typeScript\\s+:) \\d+\\.\\d+\\.\\d+`, 'g'), '$1 TYPESCRIPT_VERSION')
  str = str.replace(new RegExp(`(studio\\s+:) \\d+\\.\\d+\\.\\d+`, 'g'), '$1 STUDIO_VERSION')

  // sanitize windows specific engine names
  str = str.replace(/\.exe/g, '')

  return str
}
