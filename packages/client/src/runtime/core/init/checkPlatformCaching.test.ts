import { PrismaClientInitializationError } from '../errors/PrismaClientInitializationError'
import { checkPlatformCaching } from './checkPlatformCaching'

const consoleMock = jest.spyOn(global.console, 'error').mockImplementation()

beforeEach(() => {
  consoleMock.mockClear()
})

test('generated via postinstall on vercel', () => {
  expect(() => checkPlatformCaching({ postinstall: true, ciName: 'Vercel', clientVersion: '0.0.0' }))
    .toThrowErrorMatchingInlineSnapshot(`
    Prisma has detected that this project was built on Vercel, which caches dependencies. This leads to an outdated Prisma Client because Prisma's auto-generation isn't triggered. To fix this, make sure to run the \`prisma generate\` command during the build process.

    Learn how: https://pris.ly/d/vercel-build
  `)

  expect(consoleMock.mock.calls[0]).toMatchInlineSnapshot(`
    [
      Prisma has detected that this project was built on Vercel, which caches dependencies. This leads to an outdated Prisma Client because Prisma's auto-generation isn't triggered. To fix this, make sure to run the \`prisma generate\` command during the build process.

    Learn how: https://pris.ly/d/vercel-build,
    ]
  `)
})

test('generated on vercel', () => {
  expect(() => checkPlatformCaching({ postinstall: false, ciName: 'Vercel', clientVersion: '0.0.0' })).not.toThrow()

  expect(consoleMock.mock.calls[0]).toMatchInlineSnapshot(`undefined`)
})

test('generated via postinstall on netlify', () => {
  expect(() => checkPlatformCaching({ postinstall: true, ciName: 'Netlify CI', clientVersion: '0.0.0' }))
    .toThrowErrorMatchingInlineSnapshot(`
    Prisma has detected that this project was built on Netlify CI, which caches dependencies. This leads to an outdated Prisma Client because Prisma's auto-generation isn't triggered. To fix this, make sure to run the \`prisma generate\` command during the build process.

    Learn how: https://pris.ly/d/netlify-build
  `)

  expect(consoleMock.mock.calls[0]).toMatchInlineSnapshot(`
    [
      Prisma has detected that this project was built on Netlify CI, which caches dependencies. This leads to an outdated Prisma Client because Prisma's auto-generation isn't triggered. To fix this, make sure to run the \`prisma generate\` command during the build process.

    Learn how: https://pris.ly/d/netlify-build,
    ]
  `)
})

test('generated on netlify', () => {
  expect(() => checkPlatformCaching({ postinstall: false, ciName: 'Netlify CI', clientVersion: '0.0.0' })).not.toThrow()
  expect(consoleMock.mock.calls[0]).toMatchInlineSnapshot(`undefined`)
})

test('error is a PrismaClientInitializationError', () => {
  try {
    checkPlatformCaching({ postinstall: true, ciName: 'Netlify CI', clientVersion: '0.0.0' })
  } catch (e) {
    expect(e).toBeInstanceOf(PrismaClientInitializationError)
    expect(consoleMock.mock.calls[0]).toMatchInlineSnapshot(`
      [
        Prisma has detected that this project was built on Netlify CI, which caches dependencies. This leads to an outdated Prisma Client because Prisma's auto-generation isn't triggered. To fix this, make sure to run the \`prisma generate\` command during the build process.

      Learn how: https://pris.ly/d/netlify-build,
      ]
    `)
  }
})

export {}
