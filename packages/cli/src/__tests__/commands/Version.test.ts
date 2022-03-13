import { getCliQueryEngineType } from '@prisma/engines'
import { download, EngineType } from '@prisma/fetch-engine'
import { getPlatform } from '@prisma/get-platform'
import { engineEnvVarMap, jestConsoleContext, jestContext } from '@prisma/sdk'
import makeDir from 'make-dir'
import path from 'path'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()
const testIf = (condition: boolean) => (condition ? test : test.skip)
const useNodeAPI = getCliQueryEngineType() === EngineType.libqueryEngine
const version = '5a2e5869b69a983e279380ec68596b71beae9eff'

describe('version', () => {
  // Node-API Tests

  testIf(useNodeAPI)('basic version (Node-API)', async () => {
    const data = await ctx.cli('--version')
    expect(cleanSnapshot(data.stdout)).toMatchSnapshot()
  })

  testIf(useNodeAPI)(
    'version with custom engines (Node-API)',
    async () => {
      const enginesDir = path.join(__dirname, 'version-test-engines')
      await makeDir(enginesDir)
      const enginesPaths = await download({
        engines: {
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

  // Binary Tests

  testIf(!useNodeAPI)('basic version', async () => {
    const data = await ctx.cli('--version')
    expect(cleanSnapshot(data.stdout)).toMatchSnapshot()
  })

  testIf(!useNodeAPI)(
    'version with custom engines',
    async () => {
      const enginesDir = path.join(__dirname, 'version-test-engines')
      await makeDir(enginesDir)
      const enginePaths = await download({
        engines: {
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

function cleanSnapshot(str: string): string {
  //return str.replace(/:(.*)/g, ': placeholder')

  // sanitize engine path
  // Query Engine (Node-API) : libquery-engine e996df5d66a2314d1da15d31047f9777fc2fbdd9 (at ../../home/runner/work/prisma/prisma/node_modules/.pnpm/@prisma+engines@3.11.0-41.e996df5d66a2314d1da15d31047f9777fc2fbdd9/node_modules/@prisma/engines/libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node)
  // =>
  // Query Engine (Node-API) : libquery-engine e996df5d66a2314d1da15d31047f9777fc2fbdd9 (at sanitized_path/node_modules/@prisma/engines/libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node)
  str.replace(/at (.*)\/node_modules\/@prisma\/engines/g, 'at sanitized_path/node_modules/@prisma/engines')

  return str
}
