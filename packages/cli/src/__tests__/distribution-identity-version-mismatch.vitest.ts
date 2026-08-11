import { defaultTestConfig } from '@prisma/config'
import stripAnsi from 'strip-ansi'
import { describe, expect, test, vi } from 'vitest'

import { Generate } from '../Generate'
import type { CliDistributionIdentity } from '../utils/cli-distribution-identity'
import { getGlobalLocalVersionMismatchWarning } from '../utils/global-local-version-mismatch'
import { Version } from '../Version'

const {
  getEnginesInfoMock,
  getGeneratorsMock,
  getSchemaWithPathMock,
  getTypescriptVersionMock,
  loadSchemaContextMock,
  processSchemaResultMock,
  resolveEngineMock,
} = vi.hoisted(() => ({
  getEnginesInfoMock: vi.fn(() => ['schema-engine test', []]),
  getGeneratorsMock: vi.fn(() => Promise.resolve([])),
  getSchemaWithPathMock: vi.fn(() => Promise.resolve({ schemaPath: '/tmp/schema-root/prisma/schema.prisma' })),
  getTypescriptVersionMock: vi.fn(() => Promise.resolve('5.4.5')),
  loadSchemaContextMock: vi.fn(() => Promise.resolve({ generators: [] })),
  processSchemaResultMock: vi.fn(() => Promise.resolve({ schemaRootDir: '/tmp/schema-root' })),
  resolveEngineMock: vi.fn(() => Promise.resolve({})),
}))

vi.mock('@prisma/internals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@prisma/internals')>()

  return {
    ...actual,
    getEnginesInfo: getEnginesInfoMock,
    getGenerators: getGeneratorsMock,
    getSchemaWithPath: getSchemaWithPathMock,
    getTypescriptVersion: getTypescriptVersionMock,
    loadSchemaContext: loadSchemaContextMock,
    logger: {
      ...actual.logger,
      shouldWarn: vi.fn(() => true),
      should: {
        ...actual.logger.should,
        warn: vi.fn(() => true),
      },
    },
    resolveEngine: resolveEngineMock,
  }
})

vi.mock('../../../internals/src/cli/schemaContext', () => ({
  processSchemaResult: processSchemaResultMock,
}))

vi.mock('../utils/getClientVersion', () => ({
  getInstalledPrismaClientVersion: vi.fn(() => Promise.resolve('7.5.0')),
}))

describe.each([
  { identity: 'prisma' as const, otherIdentity: 'prisma7' },
  { identity: 'prisma7' as const, otherIdentity: 'prisma' },
])('version and mismatch identity uses $identity', ({ identity, otherIdentity }) => {
  test('version text and json label the selected distribution', async () => {
    const version = Version.new(identity)

    const text = stripAnsi((await version.parse([], defaultTestConfig())) as string)
    const json = JSON.parse((await version.parse(['--json'], defaultTestConfig())) as string) as Record<string, string>

    expect(text).toContain(`${identity}`)
    expect(text).not.toContain(`${otherIdentity}               : 0.0.0`)
    expect(json[identity]).toBe('0.0.0')
    expect(json[otherIdentity]).toBeUndefined()
    expect(json['@prisma/client']).toBe('7.5.0')
  })

  test('mismatch warning uses the selected package and recommended command', async () => {
    const getInstalledPackageVersion = vi.fn((packageName: 'prisma' | 'prisma7' | '@prisma/client') => {
      if (packageName === identity) {
        return Promise.resolve('7.4.0')
      }

      if (packageName === '@prisma/client') {
        return Promise.resolve('7.5.0')
      }

      return Promise.resolve('8.0.0')
    })

    const warning = await getGlobalLocalVersionMismatchWarning({
      cwd: '/tmp/project',
      globalVersion: '7.5.0',
      identity,
      isGlobalInstall: () => 'npm',
      getInstalledPackageVersion,
    })

    expect(warning).toContain(`${identity}@7.5.0`)
    expect(warning).toContain(`${identity}@7.4.0`)
    expect(warning).toContain(`npx ${identity} generate`)
    expect(warning).not.toContain(`${otherIdentity}@8.0.0`)
    expect(getInstalledPackageVersion).toHaveBeenCalledWith(identity, '/tmp/project')
    expect(getInstalledPackageVersion).toHaveBeenCalledWith('@prisma/client', '/tmp/project')
    expect(getInstalledPackageVersion).not.toHaveBeenCalledWith(otherIdentity, '/tmp/project')
  })

  test('generate forwards the selected identity into mismatch lookup', async () => {
    const getGlobalLocalVersionMismatchWarningMock = vi.fn(
      ({ identity: selectedIdentity }: { identity?: CliDistributionIdentity }) =>
        Promise.resolve(`warning:[${selectedIdentity}]`),
    )

    const generate = new Generate(vi.fn(), vi.fn().mockResolvedValue({ prompted: false }), {
      identity,
      getGlobalLocalVersionMismatchWarning: getGlobalLocalVersionMismatchWarningMock,
    })

    const output = stripAnsi((await generate.parse(['--no-hints'], defaultTestConfig(), '/tmp/project')) as string)

    expect(getGlobalLocalVersionMismatchWarningMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: '/tmp/schema-root',
        globalVersion: '0.0.0',
        identity,
      }),
    )
    expect(output).toContain(`warning:[${identity}]`)
    expect(output).not.toContain(`warning:[${otherIdentity}]`)
  })
})
