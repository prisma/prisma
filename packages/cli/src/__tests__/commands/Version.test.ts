import { enginesVersion, getCliQueryEngineBinaryType } from '@prisma/engines'
import { BinaryType, download } from '@prisma/fetch-engine'
import { getPlatform } from '@prisma/get-platform'
import { engineEnvVarMap, jestConsoleContext, jestContext } from '@prisma/internals'
import makeDir from 'make-dir'
import path from 'path'

import packageJson from '../../../package.json'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()
const testIf = (condition: boolean) => (condition ? test : test.skip)
const useNodeAPI = getCliQueryEngineBinaryType() === BinaryType.libqueryEngine
const version = '39190b250ebc338586e25e6da45e5e783bc8a635'

describe('version', () => {
  // Node-API Tests

  testIf(useNodeAPI)('basic version (Node-API)', async () => {
    const data = await ctx.cli('--version')
    expect(cleanSnapshot(data.stdout)).toMatchSnapshot()
  })

  testIf(useNodeAPI)(
    'version with custom binaries (Node-API)',
    async () => {
      const enginesDir = path.join(__dirname, 'version-test-engines')
      await makeDir(enginesDir)
      const binaryPaths = await download({
        binaries: {
          'introspection-engine': enginesDir,
          'migration-engine': enginesDir,
          'prisma-fmt': enginesDir,
          'libquery-engine': enginesDir,
        },
        version,
        failSilent: false,
      })
      // This Omits query-engine from the map
      const { ['query-engine']: qe, ...envVarMap } = engineEnvVarMap

      const platform = await getPlatform()

      for (const engine in envVarMap) {
        const envVar = envVarMap[engine]
        process.env[envVar] = binaryPaths[engine][platform]
        // console.debug(`Setting ${envVar} to ${binaryPaths[engine][platform]}`)
      }

      const data = await ctx.cli('--version')
      expect(cleanSnapshot(data.stdout, version)).toMatchSnapshot()

      // cleanup
      for (const engine in envVarMap) {
        const envVar = envVarMap[engine]
        delete process[envVar]
      }
    },
    50_000,
  )

  // Binary Tests

  testIf(!useNodeAPI)(
    'basic version',
    async () => {
      const data = await ctx.cli('--version')
      expect(cleanSnapshot(data.stdout)).toMatchSnapshot()
    },
    10_000,
  )

  testIf(!useNodeAPI)(
    'version with custom binaries',
    async () => {
      const enginesDir = path.join(__dirname, 'version-test-engines')
      await makeDir(enginesDir)
      const binaryPaths = await download({
        binaries: {
          'introspection-engine': enginesDir,
          'migration-engine': enginesDir,
          'prisma-fmt': enginesDir,
          'query-engine': enginesDir,
        },
        version,
        failSilent: false,
      })

      const platform = await getPlatform()
      const { ['libquery-engine']: qe, ...envVarMap } = engineEnvVarMap
      for (const engine in envVarMap) {
        const envVar = envVarMap[engine]
        process.env[envVar] = binaryPaths[engine][platform]
        // console.debug(`Setting ${envVar} to ${binaryPaths[engine][platform]}`)
      }

      const data = await ctx.cli('--version')
      expect(cleanSnapshot(data.stdout, version)).toMatchSnapshot()

      // cleanup
      for (const engine in envVarMap) {
        const envVar = envVarMap[engine]
        delete process[envVar]
      }
    },
    50_000,
  )
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

  // TODO: replace '[a-z0-9]{40}' with 'ENGINE_VERSION'.
  // Currently, the engine version of @prisma/prisma-fmt-wasm isn't necessarily the same as the enginesVersion
  str = str.replace(new RegExp('([0-9]+.[0-9]+.[0-9]+-[0-9]+.)([a-z0-9]{40})', 'g'), 'CLI_VERSION.ENGINE_VERSION')

  // replace engine version hash
  const defaultEngineVersion = enginesVersion
  const currentEngineVersion = versionOverride ?? enginesVersion
  str = str.replace(new RegExp(currentEngineVersion, 'g'), 'ENGINE_VERSION')
  str = str.replace(new RegExp(defaultEngineVersion, 'g'), 'ENGINE_VERSION')
  str = str.replace(new RegExp('workspace:\\*', 'g'), 'ENGINE_VERSION')

  // replace studio version
  str = str.replace(packageJson.devDependencies['@prisma/studio-server'], 'STUDIO_VERSION')

  // sanitize windows specific engine names
  str = str.replace(/\.exe/g, '')

  return str
}
