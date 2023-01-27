import { getSSLVersion } from '../../src/getPlatform'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

describeIf(process.platform === 'linux')('getSSLVersion', () => {
  it('should not return an error', async () => {
    const arch = 'x64'
    await getSSLVersion({ targetDistro: 'debian', arch })
    await getSSLVersion({ targetDistro: 'musl', arch })
    await getSSLVersion({ targetDistro: 'rhel', arch })
  })
})
