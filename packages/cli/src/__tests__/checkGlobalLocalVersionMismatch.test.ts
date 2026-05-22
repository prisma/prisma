import {
  formatGlobalLocalVersionMismatchWarning,
  getGlobalLocalVersionMismatchWarning,
} from '../utils/checkGlobalLocalVersionMismatch'

const GLOBAL = '7.5.0'

function build(opts: Partial<Parameters<typeof getGlobalLocalVersionMismatchWarning>[0]> = {}) {
  return getGlobalLocalVersionMismatchWarning({
    cwd: '/tmp/project',
    globalVersion: GLOBAL,
    isGlobalInstall: () => 'npm',
    getLocalPrismaCliVersion: () => Promise.resolve(null),
    getLocalPrismaClientVersion: () => Promise.resolve(null),
    ...opts,
  })
}

test('returns null when CLI is not installed globally', async () => {
  const result = await build({ isGlobalInstall: () => false })
  expect(result).toBeNull()
})

test('returns null when no local prisma or @prisma/client is installed', async () => {
  const result = await build()
  expect(result).toBeNull()
})

test('returns null when local prisma matches global version exactly', async () => {
  const result = await build({
    getLocalPrismaCliVersion: () => Promise.resolve(GLOBAL),
    getLocalPrismaClientVersion: () => Promise.resolve(GLOBAL),
  })
  expect(result).toBeNull()
})

test('warns when local prisma differs from global', async () => {
  const result = await build({
    getLocalPrismaCliVersion: () => Promise.resolve('7.4.0'),
  })
  expect(result).toContain('prisma@7.5.0')
  expect(result).toContain('prisma@7.4.0')
  expect(result).not.toContain('@prisma/client@')
})

test('warns when local @prisma/client differs from global', async () => {
  const result = await build({
    getLocalPrismaClientVersion: () => Promise.resolve('7.4.0'),
  })
  expect(result).toContain('@prisma/client@7.4.0')
})

test('warns about both prisma and @prisma/client when both differ', async () => {
  const result = await build({
    getLocalPrismaCliVersion: () => Promise.resolve('7.4.0'),
    getLocalPrismaClientVersion: () => Promise.resolve('7.3.0'),
  })
  expect(result).toContain('prisma@7.4.0')
  expect(result).toContain('@prisma/client@7.3.0')
})

test('warning only lists the local package that actually mismatches', async () => {
  const result = await build({
    getLocalPrismaCliVersion: () => Promise.resolve(GLOBAL),
    getLocalPrismaClientVersion: () => Promise.resolve('7.4.0'),
  })
  expect(result).toContain('@prisma/client@7.4.0')
  expect(result).not.toContain('prisma@7.4.0')
})

test('formatGlobalLocalVersionMismatchWarning includes both versions in the message', () => {
  const message = formatGlobalLocalVersionMismatchWarning([
    { packageName: 'prisma', globalVersion: '7.5.0', localVersion: '7.4.0' },
  ])
  expect(message).toContain('prisma@7.5.0')
  expect(message).toContain('prisma@7.4.0')
  expect(message).toContain('npx prisma generate')
})

test('formatGlobalLocalVersionMismatchWarning returns empty string for empty input', () => {
  expect(formatGlobalLocalVersionMismatchWarning([])).toBe('')
})
