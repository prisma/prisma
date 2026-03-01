import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { describe, expect, test } from 'vitest'

import { computeLibSSLSpecificPaths, getArchFromUname, getSSLVersion } from '../getPlatform'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

const fixturesDir = path.join(__dirname, 'fixtures')

const it = test.extend<{
  fixture: (name: string) => void
  tmpDir: string
}>({
  // eslint-disable-next-line no-empty-pattern
  tmpDir: async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-get-platform-'))
    await use(dir)
    fs.rmSync(dir, { recursive: true, force: true })
  },
  fixture: async ({ tmpDir }, use) => {
    await use((name: string) => {
      const src = path.join(fixturesDir, name)
      for (const file of fs.readdirSync(src)) {
        fs.copyFileSync(path.join(src, file), path.join(tmpDir, file))
      }
    })
  },
})

describeIf(process.platform === 'linux')('computeLibSSLSpecificPaths', () => {
  it('should not return an error', () => {
    const arch = 'x64'
    const archFromUname = 'x86_64'
    computeLibSSLSpecificPaths({ familyDistro: 'debian', arch, archFromUname })
  })
})

describeIf(process.platform === 'linux')('getSSLVersion', () => {
  it('should not return an error', async () => {
    const archFromUname = await getArchFromUname()
    await getSSLVersion([])
    await getSSLVersion(['/lib64'])
    await getSSLVersion([`/usr/lib/${archFromUname}-linux-gnu`])
  })

  describe('strategy: "libssl-specific-path"', () => {
    const focusedStrategy = 'libssl-specific-path'

    it('falls back with nss only', async ({ fixture, tmpDir }) => {
      fixture('libssl-specific-path/with-nss-only')
      const { strategy } = await getSSLVersion([tmpDir])
      expect(strategy).not.toEqual(focusedStrategy)
    })

    it('falls back with unknown versions only', async ({ fixture, tmpDir }) => {
      fixture('libssl-specific-path/with-unknown-versions-only')
      const { strategy } = await getSSLVersion([tmpDir])
      expect(strategy).not.toEqual(focusedStrategy)
    })

    it('selects the oldest libssl version, excluding libssl-0.x.x', async ({ fixture, tmpDir }) => {
      fixture('libssl-specific-path/with-libssl-0')
      const { libssl, strategy } = await getSSLVersion([tmpDir])
      expect(strategy).toEqual(focusedStrategy)
      expect(libssl).toEqual('1.0.x')
    })

    it('skips libssl.so without version in filename', async ({ fixture, tmpDir }) => {
      fixture('libssl-specific-path/with-versionless-libssl')
      const { libssl, strategy } = await getSSLVersion([tmpDir])
      expect(strategy).toEqual(focusedStrategy)
      expect(libssl).toEqual('1.0.x')
    })
  })
})
