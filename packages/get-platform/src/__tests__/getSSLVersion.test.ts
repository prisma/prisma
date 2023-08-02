import path from 'path'

import { permutations } from '../../../../helpers/blaze/permutations'
import { computeLibSSLSpecificPaths, getArchFromUname, getSSLVersion } from '../../src/getPlatform'
import { jestContext } from '..'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

const ctx = jestContext.new().assemble()

describeIf(process.platform === 'linux')('computeLibSSLSpecificPaths', () => {
  const originalEnv = process.env

  afterEach(() => {
    process.env = originalEnv // Restore old environment
  })

  it('should return system specific search paths when LD_LIBRARY_PATH is not set', () => {
    delete process.env.LD_LIBRARY_PATH
    const arch = 'x64'
    const archFromUname = 'x86_64'
    const paths = computeLibSSLSpecificPaths({ familyDistro: 'debian', arch, archFromUname })
    expect(paths).toEqual(['/usr/lib/x86_64-linux-gnu', '/lib/x86_64-linux-gnu'])
  })

  it('should return system specific search paths when LD_LIBRARY_PATH is an empty string', () => {
    process.env.LD_LIBRARY_PATH = ''
    const arch = 'x64'
    const archFromUname = 'x86_64'
    const paths = computeLibSSLSpecificPaths({ familyDistro: 'debian', arch, archFromUname })
    expect(paths).toEqual(['/usr/lib/x86_64-linux-gnu', '/lib/x86_64-linux-gnu'])
  })

  it('should respect LD_LIBRARY_PATH and fall back to system specific search paths', () => {
    process.env.LD_LIBRARY_PATH = '/path/to/libs:/other/path'
    const arch = 'x64'
    const archFromUname = 'x86_64'
    const paths = computeLibSSLSpecificPaths({ familyDistro: 'debian', arch, archFromUname })
    expect(paths).toEqual(['/path/to/libs', '/other/path', '/usr/lib/x86_64-linux-gnu', '/lib/x86_64-linux-gnu'])
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
    const focusedStrategy = 'libssl-specific-path'

    it('falls back with nss only', async () => {
      ctx.fixture('libssl-specific-path/with-nss-only')
      const { strategy } = await getSSLVersion([ctx.tmpDir])
      expect(strategy).not.toEqual(focusedStrategy)
    })

    it('falls back with unknown versions only', async () => {
      ctx.fixture('libssl-specific-path/with-unknown-versions-only')
      const { strategy } = await getSSLVersion([ctx.tmpDir])
      expect(strategy).not.toEqual(focusedStrategy)
    })

    it('selects the oldest libssl version, excluding libssl-0.x.x', async () => {
      ctx.fixture('libssl-specific-path/with-libssl-0')
      const { libssl, strategy } = await getSSLVersion([ctx.tmpDir])
      expect(strategy).toEqual(focusedStrategy)
      expect(libssl).toEqual('1.0.x')
    })

    it('skips libssl.so without version in filename', async () => {
      ctx.fixture('libssl-specific-path/with-versionless-libssl')
      const { libssl, strategy } = await getSSLVersion([ctx.tmpDir])
      expect(strategy).toEqual(focusedStrategy)
      expect(libssl).toEqual('1.0.x')
    })

    it('prefers older version across directories', async () => {
      ctx.fixture('libssl-specific-path/multiple-versions-across-dirs')
      for (const dirs of permutations([path.join(ctx.tmpDir, 'with-ssl1'), path.join(ctx.tmpDir, 'with-ssl3')])) {
        const { libssl, strategy } = await getSSLVersion(dirs)
        expect(strategy).toEqual(focusedStrategy)
        expect(libssl).toEqual('1.0.x')
      }
    })
  })
})
