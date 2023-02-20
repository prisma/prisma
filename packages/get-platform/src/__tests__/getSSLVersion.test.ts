import { computeLibSSLSpecificPaths, getArchFromUname, getSSLVersion } from '../../src/getPlatform'
import { jestContext } from '..'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

const ctx = jestContext.new().assemble()

describeIf(process.platform === 'linux')('computeLibSSLSpecificPaths', () => {
  // eslint-disable-next-line jest/no-identical-title
  it('should not return an error', () => {
    const arch = 'x64'
    const archFromUname = 'x86_64'
    computeLibSSLSpecificPaths({ familyDistro: 'debian', arch, archFromUname })
  })
})

describeIf(process.platform === 'linux')('getSSLVersion', () => {
  // eslint-disable-next-line jest/no-identical-title
  it('should not return an error', async () => {
    const archFromUname = await getArchFromUname()
    await getSSLVersion([])
    await getSSLVersion(['/lib64'])
    await getSSLVersion([`/usr/lib/${archFromUname}-linux-gnu`])
  })

  describe('strategy: "libssl-specific-path"', () => {
    it('falls back with nss only', async () => {
      ctx.fixture('libssl-specific-path/with-nss-only')
      const { strategy } = await getSSLVersion([ctx.tmpDir])
      expect(strategy).toEqual(undefined)
    })

    it('falls back with unknown versions only', async () => {
      ctx.fixture('libssl-specific-path/with-unknown-versions-only')
      const { strategy } = await getSSLVersion([ctx.tmpDir])
      expect(strategy).toEqual(undefined)
    })

    it('selects the oldest libssl version, excluding libssl-0.x.x', async () => {
      ctx.fixture('libssl-specific-path/with-libssl-0')
      const { libssl, strategy } = await getSSLVersion([ctx.tmpDir])
      expect(strategy).toEqual('libssl-specific-path')
      expect(libssl).toEqual('1.0.x')
    })
  })
})
