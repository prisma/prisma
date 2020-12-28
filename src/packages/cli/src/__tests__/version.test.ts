import { consoleContext, Context } from './__helpers__/context'
import { download } from '@prisma/fetch-engine'
import path from 'path'
import makeDir from 'make-dir'
import { engineEnvVarMap } from '@prisma/sdk'
import { getPlatform } from '@prisma/get-platform'

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
      },
      version: '58369335532e47bdcec77a2f1e7c1fb83a463918',
      failSilent: false,
    })

    const platform = await getPlatform()

    for (const engine in engineEnvVarMap) {
      const envVar = engineEnvVarMap[engine]
      process.env[envVar] = binaryPaths[engine][platform]
      console.debug(`Setting ${envVar} to ${binaryPaths[engine][platform]}`)
    }

    const data = await ctx.cli('--version')
    expect(cleanSnapshot(data.stdout)).toMatchSnapshot()

    // cleanup
    for (const engine in engineEnvVarMap) {
      const envVar = engineEnvVarMap[engine]
      delete process[envVar]
    }
  })
})

function cleanSnapshot(str: string): string {
  return str.replace(/\(at .*/g, '')
}
