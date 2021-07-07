import { download } from '@prisma/fetch-engine'
import { getPlatform } from '@prisma/get-platform'
import { engineEnvVarMap } from '@prisma/sdk'
import makeDir from 'make-dir'
import path from 'path'
import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()
const testIf = (condition: boolean) => (condition ? test : test.skip)
const useNodeAPI = process.env.PRISMA_FORCE_NAPI === 'true'
const version = 'e6bd3dc12d849124a04c3a8e6bd9c194381afda3'

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
      expect(cleanSnapshot(data.stdout)).toMatchSnapshot()

      // cleanup
      for (const engine in envVarMap) {
        const envVar = envVarMap[engine]
        delete process[envVar]
      }
    },
    20000,
  )

  // Binary Tests

  testIf(!useNodeAPI)('basic version', async () => {
    const data = await ctx.cli('--version')
    expect(cleanSnapshot(data.stdout)).toMatchSnapshot()
  })

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
      expect(cleanSnapshot(data.stdout)).toMatchSnapshot()

      // cleanup
      for (const engine in envVarMap) {
        const envVar = envVarMap[engine]
        delete process[envVar]
      }
    },
    20000,
  )
})

function cleanSnapshot(str: string): string {
  return str.replace(/:(.*)/g, ': placeholder')
}
