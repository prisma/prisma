import { getCliQueryEngineType } from '@prisma/engines'
import { download, EngineType } from '@prisma/fetch-engine'
import { getPlatform } from '@prisma/get-platform'
import { engineEnvVarMap, jestConsoleContext, jestContext } from '@prisma/sdk'
import makeDir from 'make-dir'
import path from 'path'

const packageJson = require('../../../package.json') // eslint-disable-line @typescript-eslint/no-var-requires

const ctx = jestContext.new().add(jestConsoleContext()).assemble()
const testIf = (condition: boolean) => (condition ? test : test.skip)
const useNodeAPI = getCliQueryEngineType() === EngineType.libqueryEngine
const staticVersion = '5a2e5869b69a983e279380ec68596b71beae9eff'

describe('version', () => {
  // Basic (with up to date version)

  testIf(useNodeAPI)('basic (Node-API)', async () => {
    // Separate from binary tests so it has its own snapshots
    const data = await ctx.cli('--version')
    expect(cleanSnapshot(data.stdout)).toMatchSnapshot()
  })

  testIf(!useNodeAPI)('basic (binary)', async () => {
    // Separate from library tests so it has its own snapshots
    const data = await ctx.cli('--version')
    expect(cleanSnapshot(data.stdout)).toMatchSnapshot()
  })

  // Custom Engines (with static, explicit version)

  testIf(useNodeAPI)(
    'with custom engines (Node-API)',
    async () => {
      // Separate from binary tests as it removes the binary query-engine manually from the map
      const enginesDir = path.join(__dirname, 'version-test-engines')
      await makeDir(enginesDir)
      const enginesPaths = await download({
        engines: {
          'introspection-engine': enginesDir,
          'migration-engine': enginesDir,
          'prisma-fmt': enginesDir,
          'libquery-engine': enginesDir,
        },
        version: staticVersion,
        failSilent: false,
      })
      // This Omits binary query-engine from the map
      const { ['query-engine']: qe, ...envVarMap } = engineEnvVarMap

      const platform = await getPlatform()

      for (const engine in envVarMap) {
        const envVar = envVarMap[engine]
        process.env[envVar] = enginesPaths[engine][platform]
        // console.debug(`Setting ${envVar} to ${enginesPaths[engine][platform]}`)
      }

      const data = await ctx.cli('--version')
      expect(cleanSnapshot(data.stdout)).toMatchSnapshot()

      // cleanup
      for (const engine in envVarMap) {
        const envVar = envVarMap[engine]
        delete process[envVar]
      }
    },
    50000,
  )

  testIf(!useNodeAPI)(
    'with custom engines (binary)',
    async () => {
      // Separate from binary tests as it removes the library query-engine manually from the map
      const enginesDir = path.join(__dirname, 'version-test-engines')
      await makeDir(enginesDir)
      const enginePaths = await download({
        engines: {
          'introspection-engine': enginesDir,
          'migration-engine': enginesDir,
          'prisma-fmt': enginesDir,
          'query-engine': enginesDir,
        },
        version: staticVersion,
        failSilent: false,
      })
      // This Omits library query-engine from the map
      const { ['libquery-engine']: qe, ...envVarMap } = engineEnvVarMap

      const platform = await getPlatform()

      for (const engine in envVarMap) {
        const envVar = envVarMap[engine]
        process.env[envVar] = enginePaths[engine][platform]
        // console.debug(`Setting ${envVar} to ${enginePaths[engine][platform]}`)
      }

      const data = await ctx.cli('--version')
      expect(cleanSnapshot(data.stdout)).toMatchSnapshot()

      // cleanup
      for (const engine in envVarMap) {
        const envVar = envVarMap[engine]
        delete process[envVar]
      }
    },
    50000,
  )
})

// TODO Extract to snapshot serializer instead of manually calling
function cleanSnapshot(str: string): string {
  //return str.replace(/:(.*)/g, ': placeholder')

  // sanitize engine path
  // Query Engine (Node-API) : libquery-engine e996df5d66a2314d1da15d31047f9777fc2fbdd9 (at ../../home/runner/work/prisma/prisma/node_modules/.pnpm/@prisma+engines@3.11.0-41.e996df5d66a2314d1da15d31047f9777fc2fbdd9/node_modules/@prisma/engines/libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node)
  // +                                                                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  // Query Engine (Node-API) : libquery-engine 5a2e5869b69a983e279380ec68596b71beae9eff (at ../../cli/src/__tests__/commands/version-test-engines/libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node, resolved by PRISMA_QUERY_ENGINE_LIBRARY)
  // =>                                                                                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  // Query Engine (Node-API) : libquery-engine e996df5d66a2314d1da15d31047f9777fc2fbdd9 (at sanitized_path/libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node)
  //                                                                                    ^^^^^^^^^^^^^^^^^^^
  str = str.replace(/\(at (.*engines)(\/|\\)/g, '(at sanitized_path/')

  // replace engine version hash
  str = str.replace(/staticVersion/g, 'STATICENGINEVERSION')
  const search = new RegExp(packageJson.dependencies['@prisma/engines'].split('.').pop(), 'g')
  str = str.replace(search, 'DYNAMICENGINEVERSION')

  // replace studio version
  str = str.replace(packageJson.devDependencies['@prisma/studio-server'], 'STUDIOVERSION')

  return str
}
