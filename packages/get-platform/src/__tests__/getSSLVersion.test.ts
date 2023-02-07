import { getSSLVersion } from '../../src/getPlatform'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

describeIf(process.platform === 'linux')('getSSLVersion', () => {
  it('should not return an error', async () => {
    const arch = 'x64'
    const archFromUname = 'x86_64'
    await getSSLVersion({ targetDistro: 'debian', arch, archFromUname })
    await getSSLVersion({ targetDistro: 'musl', arch, archFromUname })
    await getSSLVersion({ targetDistro: 'rhel', arch, archFromUname })
  })
})
