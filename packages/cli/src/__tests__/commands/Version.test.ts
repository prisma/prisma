import { enginesVersion } from '@prisma/engines'
import { download } from '@prisma/fetch-engine'
import { getBinaryTargetForCurrentPlatform, jestConsoleContext, jestContext } from '@prisma/get-platform'
import { engineEnvVarMap } from '@prisma/internals'
import { ensureDir } from 'fs-extra'
import path from 'path'
import { version as typeScriptVersion } from 'typescript'

import packageJson from '../../../package.json'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

describe('version', () => {
  describe('shows @prisma/schema-engine-wasm when config.migrate.adapter is set', () => {
    test('does not download query-engine when engine type is client', async () => {
      ctx.fixture('prisma-config-dont-download-engines')
      const data = await ctx.cli('version')
      expect(data.exitCode).toBe(0)
      expect(cleanSnapshot(data.stdout)).toMatchInlineSnapshot(`
        "Prisma schema loaded from schema.prisma
        prisma                : 0.0.0
        @prisma/client        : 0.0.0
        Computed binaryTarget : TEST_PLATFORM
        Operating System      : OS
        Architecture          : ARCHITECTURE
        Node.js               : NODEJS_VERSION
        TypeScript            : TYPESCRIPT_VERSION
        Query Engine          : Client Engine (WASM)
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

  test('basic version', async () => {
    const data = await ctx.cli('--version')
    expect(cleanSnapshot(data.stdout)).toMatchSnapshot()
  })

  test('version with custom binaries', async () => {
    const enginesDir = path.join(__dirname, 'version-test-engines')
    await ensureDir(enginesDir)
    const binaryPaths = await download({
      binaries: {
        'schema-engine': enginesDir,
      },
      version: enginesVersion,
      failSilent: false,
    })
    const envVarMap = engineEnvVarMap

    const binaryTarget = await getBinaryTargetForCurrentPlatform()

    for (const engine in envVarMap) {
      const envVar = envVarMap[engine]
      process.env[envVar] = binaryPaths[engine][binaryTarget]
    }

    const data = await ctx.cli('--version')
    expect(cleanSnapshot(data.stdout, enginesVersion)).toMatchSnapshot()

    // cleanup
    for (const engine in envVarMap) {
      const envVar = envVarMap[engine]
      delete process[envVar]
    }
  }, 50_000)

  test('version with custom Schema Binary', async () => {
    const enginesDir = path.join(__dirname, 'version-test-engines')
    await ensureDir(enginesDir)
    const binaryPaths = await download({
      binaries: {
        'schema-engine': enginesDir,
      },
      version: enginesVersion,
      failSilent: false,
    })

    const binaryTarget = await getBinaryTargetForCurrentPlatform()
    const envVarMap = engineEnvVarMap
    for (const engine in envVarMap) {
      const envVar = envVarMap[engine]
      process.env[envVar] = binaryPaths[engine][binaryTarget]
    }

    const data = await ctx.cli('--version')
    expect(cleanSnapshot(data.stdout, enginesVersion)).toMatchSnapshot()

    // cleanup
    for (const engine in envVarMap) {
      const envVar = envVarMap[engine]
      delete process[envVar]
    }
  }, 50_000)
})

function cleanSnapshot(str: string, versionOverride?: string): string {
  // sanitize engine paths
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
