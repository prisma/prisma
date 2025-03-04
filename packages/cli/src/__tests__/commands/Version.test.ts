import { enginesVersion, getCliQueryEngineBinaryType } from '@prisma/engines'
import { BinaryType, download } from '@prisma/fetch-engine'
import { getBinaryTargetForCurrentPlatform, jestConsoleContext, jestContext } from '@prisma/get-platform'
import { engineEnvVarMap } from '@prisma/internals'
import { ensureDir } from 'fs-extra'
import path from 'node:path'
import { version as typeScriptVersion } from 'typescript'

import packageJson from '../../../package.json'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()
const testIf = (condition: boolean) => (condition ? test : test.skip)
const runLibraryTest =
  getCliQueryEngineBinaryType() === BinaryType.QueryEngineLibrary && !process.env.PRISMA_QUERY_ENGINE_LIBRARY

const runBinaryTest =
  getCliQueryEngineBinaryType() === BinaryType.QueryEngineBinary && !process.env.PRISMA_QUERY_ENGINE_BINARY

describe('version', () => {
  // Node-API Tests

  testIf(runLibraryTest)('basic version (Node-API)', async () => {
    const data = await ctx.cli('--version')
    return expect(cleanSnapshot(data.stdout)).toMatchSnapshot()
  })

  testIf(runLibraryTest)(
    'version with custom binaries (Node-API)',
    async () => {
      const enginesDir = path.join(__dirname, 'version-test-engines')
      await ensureDir(enginesDir)
      const binaryPaths = await download({
        binaries: {
          'schema-engine': enginesDir,
          'libquery-engine': enginesDir,
        },
        version: enginesVersion,
        failSilent: false,
      })
      // This Omits query-engine from the map
      const { 'query-engine': qe, ...envVarMap } = engineEnvVarMap

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
    },
    50_000,
  )

  // Binary Tests

  testIf(runBinaryTest)(
    'basic version',
    async () => {
      const data = await ctx.cli('--version')
      return expect(cleanSnapshot(data.stdout)).toMatchSnapshot()
    },
    10_000,
  )

  testIf(runBinaryTest)(
    'version with custom binaries',
    async () => {
      const enginesDir = path.join(__dirname, 'version-test-engines')
      await ensureDir(enginesDir)
      const binaryPaths = await download({
        binaries: {
          'schema-engine': enginesDir,
          'query-engine': enginesDir,
        },
        version: enginesVersion,
        failSilent: false,
      })

      const binaryTarget = await getBinaryTargetForCurrentPlatform()
      const { 'libquery-engine': qe, ...envVarMap } = engineEnvVarMap
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
    },
    50_000,
  )
})

function cleanSnapshot(inputStr: string, versionOverride?: string): string {
  // sanitize engine path
  // Query Engine (Node-API) : libquery-engine e996df5d66a2314d1da15d31047f9777fc2fbdd9 (at ../../home/runner/work/prisma/prisma/node_modules/.pnpm/@prisma+engines@3.11.0-41.e996df5d66a2314d1da15d31047f9777fc2fbdd9/node_modules/@prisma/engines/libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node)
  // +                                                                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  // Query Engine (Node-API) : libquery-engine 5a2e5869b69a983e279380ec68596b71beae9eff (at ../../cli/src/__tests__/commands/version-test-engines/libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node, resolved by PRISMA_QUERY_ENGINE_LIBRARY)
  // =>                                                                                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  // Query Engine (Node-API) : libquery-engine e996df5d66a2314d1da15d31047f9777fc2fbdd9 (at sanitized_path/libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node)
  //                                                                                    ^^^^^^^^^^^^^^^^^^^
  let result = inputStr.replace(/\(at (.*engines)(\/|\\)/g, '(at sanitized_path/')

  // TODO: replace '[a-z0-9]{40}' with 'ENGINE_VERSION'.
  // Currently, the engine version of @prisma/prisma-schema-wasm isn't necessarily the same as the enginesVersion
  result = result.replace(/([0-9]+\.[0-9]+\.[0-9]+-[0-9]+\.)([a-z0-9-]+)/g, 'CLI_VERSION.ENGINE_VERSION')

  // replace engine version hash
  const defaultEngineVersion = enginesVersion
  const currentEngineVersion = versionOverride ?? enginesVersion
  result = result.replace(new RegExp(currentEngineVersion, 'g'), 'ENGINE_VERSION')
  result = result.replace(new RegExp(defaultEngineVersion, 'g'), 'ENGINE_VERSION')
  result = result.replace(/(Operating System\s+:).*/g, '$1 OS')
  result = result.replace(/(Architecture\s+:).*/g, '$1 ARCHITECTURE')
  result = result.replace(/workspace:\*/g, 'ENGINE_VERSION')
  result = result.replace(new RegExp(process.version, 'g'), 'NODEJS_VERSION')
  result = result.replace(new RegExp(`(TypeScript\\s+:) ${typeScriptVersion}`, 'g'), '$1 TYPESCRIPT_VERSION')

  // replace studio version
  result = result.replace(packageJson.devDependencies['@prisma/studio-server'], 'STUDIO_VERSION')

  // sanitize windows specific engine names
  result = result.replace(/\.exe/g, '')

  return result
}
