import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { getInstalledPrismaCliVersion, shouldWarnGlobalLocalCliMismatch } from './getClientVersion'

describe('shouldWarnGlobalLocalCliMismatch', () => {
  test('warns when global CLI version differs from locally installed prisma', () => {
    expect(
      shouldWarnGlobalLocalCliMismatch({
        isGlobalInstall: true,
        globalCliVersion: '7.0.0',
        installedLocalPrismaCliVersion: '6.5.0',
      }),
    ).toBe(true)
  })

  test('does not warn when versions match', () => {
    expect(
      shouldWarnGlobalLocalCliMismatch({
        isGlobalInstall: true,
        globalCliVersion: '7.0.0',
        installedLocalPrismaCliVersion: '7.0.0',
      }),
    ).toBe(false)
  })

  test('does not warn when CLI is not globally installed', () => {
    expect(
      shouldWarnGlobalLocalCliMismatch({
        isGlobalInstall: false,
        globalCliVersion: '7.0.0',
        installedLocalPrismaCliVersion: '6.5.0',
      }),
    ).toBe(false)
  })

  test('does not warn when no local prisma is detected', () => {
    expect(
      shouldWarnGlobalLocalCliMismatch({
        isGlobalInstall: true,
        globalCliVersion: '7.0.0',
        installedLocalPrismaCliVersion: null,
      }),
    ).toBe(false)
  })

  // Defensive: `installedLocalPrismaCliVersion` is always read from an installed
  // `node_modules/prisma/package.json` `version` field, so in practice it is a
  // well-formed version. These cases lock in that a malformed / non-exact-semver
  // `version` value never produces a (misleading) warning.
  test.each([
    ['empty string', ''],
    ['partial version', '7'],
    ['partial version with minor', '7.0'],
    ['leading v', 'v7.0.0'],
    ['non-version string', 'not-a-version'],
  ])('does not warn for a non-exact-semver installed version (%s)', (_label, version) => {
    expect(
      shouldWarnGlobalLocalCliMismatch({
        isGlobalInstall: true,
        globalCliVersion: '7.0.0',
        installedLocalPrismaCliVersion: version,
      }),
    ).toBe(false)
  })

  test('accepts prerelease semver as exact comparable', () => {
    expect(
      shouldWarnGlobalLocalCliMismatch({
        isGlobalInstall: true,
        globalCliVersion: '7.0.0',
        installedLocalPrismaCliVersion: '7.0.0-beta.1',
      }),
    ).toBe(true)
  })

  test('does not warn when global version itself is not exact semver', () => {
    expect(
      shouldWarnGlobalLocalCliMismatch({
        isGlobalInstall: true,
        globalCliVersion: 'placeholder-not-a-version',
        installedLocalPrismaCliVersion: '7.0.0',
      }),
    ).toBe(false)
  })
})

describe('getInstalledPrismaCliVersion', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-cli-version-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('returns the installed prisma version from node_modules', async () => {
    const prismaDir = path.join(tmpDir, 'node_modules', 'prisma')
    fs.mkdirSync(prismaDir, { recursive: true })
    fs.writeFileSync(path.join(prismaDir, 'package.json'), JSON.stringify({ name: 'prisma', version: '6.5.0' }))

    const result = await getInstalledPrismaCliVersion(tmpDir)
    expect(result).toBe('6.5.0')
  })

  test('returns null when prisma is not installed locally', async () => {
    const result = await getInstalledPrismaCliVersion(tmpDir)
    expect(result).toBeNull()
  })

  test('returns null when node_modules/prisma/package.json has no version', async () => {
    const prismaDir = path.join(tmpDir, 'node_modules', 'prisma')
    fs.mkdirSync(prismaDir, { recursive: true })
    fs.writeFileSync(path.join(prismaDir, 'package.json'), JSON.stringify({ name: 'prisma' }))

    const result = await getInstalledPrismaCliVersion(tmpDir)
    expect(result).toBeNull()
  })

  test('returns null when the version field is not a string', async () => {
    const prismaDir = path.join(tmpDir, 'node_modules', 'prisma')
    fs.mkdirSync(prismaDir, { recursive: true })
    fs.writeFileSync(path.join(prismaDir, 'package.json'), JSON.stringify({ name: 'prisma', version: 7 }))

    const result = await getInstalledPrismaCliVersion(tmpDir)
    expect(result).toBeNull()
  })

  test('walks up from cwd and finds prisma in a parent directory', async () => {
    const nestedCwd = path.join(tmpDir, 'apps', 'api')
    fs.mkdirSync(nestedCwd, { recursive: true })

    const prismaDir = path.join(tmpDir, 'node_modules', 'prisma')
    fs.mkdirSync(prismaDir, { recursive: true })
    fs.writeFileSync(path.join(prismaDir, 'package.json'), JSON.stringify({ name: 'prisma', version: '6.5.0' }))

    const result = await getInstalledPrismaCliVersion(nestedCwd)
    expect(result).toBe('6.5.0')
  })

  test('returns null on a malformed package.json without continuing to walk up', async () => {
    // Inner node_modules/prisma/package.json is corrupt; outer one has a real version.
    // The function must NOT silently fall through to the outer install.
    const innerDir = path.join(tmpDir, 'inner')
    const innerPrismaDir = path.join(innerDir, 'node_modules', 'prisma')
    fs.mkdirSync(innerPrismaDir, { recursive: true })
    fs.writeFileSync(path.join(innerPrismaDir, 'package.json'), 'not valid json{')

    const outerPrismaDir = path.join(tmpDir, 'node_modules', 'prisma')
    fs.mkdirSync(outerPrismaDir, { recursive: true })
    fs.writeFileSync(path.join(outerPrismaDir, 'package.json'), JSON.stringify({ name: 'prisma', version: '9.9.9' }))

    const result = await getInstalledPrismaCliVersion(innerDir)
    expect(result).toBeNull()
  })
})
