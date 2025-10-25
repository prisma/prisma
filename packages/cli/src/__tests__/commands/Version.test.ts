import { enginesVersion } from '@prisma/engines'
import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import { version as typeScriptVersion } from 'typescript'

import packageJson from '../../../package.json'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

describe('version', () => {
  describe('shows @prisma/schema-engine-wasm when config.migrate.adapter is set', () => {
    test('shows query-engine library when queryCompiler is turned off', async () => {
      ctx.fixture('prisma-config-dont-download-schema-engine')
      const data = await ctx.cli('version')
      expect(data.exitCode).toBe(0)
      expect(cleanSnapshot(data.stdout)).toMatchInlineSnapshot(`
        "Prisma schema loaded from schema.prisma
        prisma                : 0.0.0
        @prisma/client        : 0.0.0
        Operating System      : OS
        Architecture          : ARCHITECTURE
        Node.js               : NODEJS_VERSION
        TypeScript            : TYPESCRIPT_VERSION
        Query Compiler        : enabled
        PSL                   : @prisma/prisma-schema-wasm CLI_VERSION.ENGINE_VERSION
        Schema Engine         : @prisma/schema-engine-wasm CLI_VERSION.ENGINE_VERSION
        Schema Engine Adapter : @prisma/adapter-mock
        Default Engines Hash  : ENGINE_VERSION
        Studio                : STUDIO_VERSION"
      `)
      expect(cleanSnapshot(data.stderr)).toMatchInlineSnapshot(`
        "Loaded Prisma config from prisma.config.ts.

        Prisma config detected, skipping environment variable loading."
      `)
    })

    describe('bypassing query engine env vars', () => {
      const originalEnv = { ...process.env }
      const resetEnv = () => {
        for (const key of Object.keys(process.env)) {
          if (!(key in originalEnv)) {
            delete process.env[key]
          }
        }

        for (const [key, value] of Object.entries(originalEnv)) {
          if (value === undefined) {
            delete process.env[key]
          } else {
            process.env[key] = value
          }
        }
      }

      beforeAll(() => {
        resetEnv()
        delete process.env.PRISMA_CLIENT_ENGINE_TYPE
      })

      afterAll(() => {
        resetEnv()
      })

      test('does not download query-engine when engine type is client', async () => {
        ctx.fixture('prisma-config-dont-download-engines')
        const data = await ctx.cli('version')
        expect(data.exitCode).toBe(0)
        expect(cleanSnapshot(data.stdout)).toMatchInlineSnapshot(`
          "Prisma schema loaded from schema.prisma
          prisma                : 0.0.0
          @prisma/client        : 0.0.0
          Operating System      : OS
          Architecture          : ARCHITECTURE
          Node.js               : NODEJS_VERSION
          TypeScript            : TYPESCRIPT_VERSION
          Query Compiler        : enabled
          PSL                   : @prisma/prisma-schema-wasm CLI_VERSION.ENGINE_VERSION
          Schema Engine         : @prisma/schema-engine-wasm CLI_VERSION.ENGINE_VERSION
          Schema Engine Adapter : @prisma/adapter-mock
          Default Engines Hash  : ENGINE_VERSION
          Studio                : STUDIO_VERSION"
        `)
        expect(cleanSnapshot(data.stderr)).toMatchInlineSnapshot(`
          "Loaded Prisma config from prisma.config.ts.

          Prisma config detected, skipping environment variable loading."
        `)
      })
    })
  })
})

function cleanSnapshot(str: string, versionOverride?: string): string {
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
  str = str.replace(new RegExp('(Operating System\\s+:).*', 'g'), '$1 OS')
  str = str.replace(new RegExp('(Architecture\\s+:).*', 'g'), '$1 ARCHITECTURE')
  str = str.replace(new RegExp('workspace:\\*', 'g'), 'ENGINE_VERSION')
  str = str.replace(new RegExp(process.version, 'g'), 'NODEJS_VERSION')
  str = str.replace(new RegExp(`(TypeScript\\s+:) ${typeScriptVersion}`, 'g'), '$1 TYPESCRIPT_VERSION')

  // replace studio version
  str = str.replace(packageJson.devDependencies['@prisma/studio-server'], 'STUDIO_VERSION')

  // sanitize windows specific engine names
  str = str.replace(/\.exe/g, '')

  return str
}
