import { download } from '@prisma/fetch-engine'
import { getPlatform } from '@prisma/get-platform'
import { engineEnvVarMap } from '@prisma/sdk'
import makeDir from 'make-dir'
import path from 'path'
import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

describe('version', () => {
  test('basic version', async () => {
    const data = await ctx.cli('--version')

    expect(cleanSnapshot(data.stdout)).toMatchSnapshot()
  })

  test('version with custom binaries', async () => {
    const enginesDir = path.join(__dirname, 'version-test-engines')
    await makeDir(enginesDir)
    const binaryPaths = await download({
      binaries: {
        'introspection-engine': enginesDir,
        'migration-engine': enginesDir,
        'prisma-fmt': enginesDir,
        'query-engine': enginesDir,
        'libquery-engine-napi': enginesDir,
      },
      version: '2beb202d1edf364097cece4300649f1f98557d61',
      failSilent: false,
    })

    const platform = await getPlatform()

    for (const engine in engineEnvVarMap) {
      const envVar = engineEnvVarMap[engine]
      process.env[envVar] = binaryPaths[engine][platform]
      // console.debug(`Setting ${envVar} to ${binaryPaths[engine][platform]}`)
    }

    const data = await ctx.cli('--version')
    expect(cleanSnapshot(data.stdout)).toMatchSnapshot()

    // cleanup
    for (const engine in engineEnvVarMap) {
      const envVar = engineEnvVarMap[engine]
      delete process[envVar]
    }
  }, 20000)
})

function cleanSnapshot(str: string): string {
  return str.replace(/:(.*)/g, ': placeholder')
}
