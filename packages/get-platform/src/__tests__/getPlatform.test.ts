import stripAnsi from 'strip-ansi'

import { getPlatformInternal, getPlatformMemoized } from '../getPlatform'
import { jestConsoleContext, jestContext } from '../test-utils'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

describe('getPlatformMemoized', () => {
  it('repeated invocations are idempotent and memoized', async () => {
    const platformFirst = await getPlatformMemoized()
    const platformSecond = await getPlatformMemoized()

    expect(platformFirst.platform).toBe(platformSecond.platform)
    expect(platformFirst.memoized).toBeFalsy()
    expect(platformSecond.memoized).toBeTruthy()
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})

describe('getPlatformInternal', () => {
  describe('linux', () => {
    const platform = 'linux'

    // test name convention: <originalDistro> (<familyDistro>), <arch> (<uname -m>), openssl-<libssl>

    it('debian (debian), amd64 (x86_64), openssl-1.1.x', () => {
      expect(
        getPlatformInternal({
          platform,
          libssl: '1.1.x',
          arch: 'x64',
          archFromUname: 'x86_64',
          familyDistro: 'debian',
          originalDistro: 'debian',
          targetDistro: 'debian',
        }),
      ).toBe('debian-openssl-1.1.x')
      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })

    it('alpine (alpine), amd64 (x86_64), openssl-3.0.x', () => {
      expect(
        getPlatformInternal({
          platform,
          libssl: '3.0.x',
          arch: 'x64',
          archFromUname: 'x86_64',
          familyDistro: 'alpine',
          originalDistro: 'alpine',
          targetDistro: 'musl',
        }),
      ).toBe('linux-musl-openssl-3.0.x')
      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })

    it('alpine (alpine), arm64 (aarch64), openssl-3.0.x', () => {
      expect(
        getPlatformInternal({
          platform,
          libssl: '3.0.x',
          arch: 'arm64',
          archFromUname: 'aarch64',
          familyDistro: 'alpine',
          originalDistro: 'alpine',
          targetDistro: 'musl',
        }),
      ).toBe('linux-musl-arm64-openssl-3.0.x')
      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })

    it('alpine (alpine), arm (armv7l), openssl-3.0.x', () => {
      expect(
        getPlatformInternal({
          platform,
          libssl: '3.0.x',
          arch: 'arm',
          archFromUname: 'armv7l',
          familyDistro: 'alpine',
          originalDistro: 'alpine',
          targetDistro: 'musl',
        }),
      ).toBe('linux-arm-openssl-3.0.x')
      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      // TODO: can't currently use `toMatchInlineSnaphost` here because our snaphost serialiser replaces "arm" with
      // "TEST_PLATFORM" unnecessarily.
      expect(stripAnsi(ctx.mocked['console.warn'].mock.calls.join('\n') as string)).toBe(
        `prisma:warn Prisma only officially supports Linux on amd64 (x86_64) and arm64 (aarch64) system architectures. If you are using your own custom Prisma engines, you can ignore this warning, as long as you've compiled the engines for your system architecture "armv7l".`,
      )
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })

    it('ubuntu (debian), amd64 (x86_64), openssl-undefined', () => {
      expect(
        getPlatformInternal({
          platform,
          libssl: undefined,
          arch: 'x64',
          archFromUname: 'x86_64',
          familyDistro: 'debian',
          originalDistro: 'ubuntu',
          targetDistro: 'debian',
        }),
      ).toBe('debian-openssl-1.1.x')
      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        prisma:warn Prisma failed to detect the libssl/openssl version to use, and may not work as expected. Defaulting to "openssl-1.1.x".
        Please manually install OpenSSL via \`apt-get update -y && apt-get install -y openssl\` and try installing Prisma again. If you're running Prisma on Docker, you may also try to replace your base image with \`node:lts-slim\`, which already ships with OpenSSL installed.
      `)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })

    it('arch (arch), amd64 (x86_64), openssl-undefined', () => {
      expect(
        getPlatformInternal({
          platform,
          libssl: undefined,
          arch: 'x64',
          archFromUname: 'x86_64',
          familyDistro: 'arch',
          originalDistro: 'arch',
          targetDistro: 'debian',
        }),
      ).toBe('debian-openssl-1.1.x')
      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        prisma:warn Prisma failed to detect the libssl/openssl version to use, and may not work as expected. Defaulting to "openssl-1.1.x".
        Please manually install OpenSSL and try installing Prisma again.
      `)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })

    it('unknown (unknown), amd64 (x86_64), openssl-3.0.x', () => {
      expect(
        getPlatformInternal({
          platform,
          libssl: '3.0.x',
          arch: 'x64',
          archFromUname: 'x86_64',
          familyDistro: undefined,
          originalDistro: 'unknown',
          targetDistro: undefined,
        }),
      ).toBe('debian-openssl-3.0.x')
      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        prisma:warn Prisma doesn't know which engines to download for the Linux distro "unknown". Falling back to Prisma engines built "debian".
        Please report your experience by creating an issue at https://github.com/prisma/prisma/issues so we can add your distro to the list of known supported distros.
      `)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })

    it('unknown (unknown), amd64 (x86_64), openssl-undefined', () => {
      expect(
        getPlatformInternal({
          platform,
          libssl: undefined,
          arch: 'x64',
          archFromUname: 'x86_64',
          familyDistro: undefined,
          originalDistro: 'unknown',
          targetDistro: undefined,
        }),
      ).toBe('debian-openssl-1.1.x')
      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        prisma:warn Prisma failed to detect the libssl/openssl version to use, and may not work as expected. Defaulting to "openssl-1.1.x".
        Please manually install OpenSSL and try installing Prisma again.
        prisma:warn Prisma doesn't know which engines to download for the Linux distro "unknown". Falling back to Prisma engines built "debian".
        Please report your experience by creating an issue at https://github.com/prisma/prisma/issues so we can add your distro to the list of known supported distros.
      `)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })
})
