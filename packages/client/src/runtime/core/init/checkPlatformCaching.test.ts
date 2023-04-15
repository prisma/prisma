import { PrismaClientInitializationError } from '@prisma/engine-core'

import { checkPlatformCaching } from './checkPlatformCaching'

test('generated via postinstall on vercel', () => {
  const consoleMock = jest.spyOn(global.console, 'error').mockImplementation()

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
  const consoleMock = jest.spyOn(console, 'error').mockImplementation()

  expect(() => checkPlatformCaching({ postinstall: false, ciName: 'Vercel', clientVersion: '0.0.0' })).not.toThrow()

  expect(consoleMock.mock.calls[0]).toMatchInlineSnapshot(`
    [
      Prisma has detected that this project was built on Vercel, which caches dependencies. This leads to an outdated Prisma Client because Prisma's auto-generation isn't triggered. To fix this, make sure to run the \`prisma generate\` command during the build process.

    Learn how: https://pris.ly/d/vercel-build,
    ]
  `)
})

test('generated via postinstall on netlify', () => {
  const consoleMock = jest.spyOn(console, 'error').mockImplementation()

  expect(() => checkPlatformCaching({ postinstall: true, ciName: 'Netlify CI', clientVersion: '0.0.0' }))
    .toThrowErrorMatchingInlineSnapshot(`
    Prisma has detected that this project was built on Netlify CI, which caches dependencies. This leads to an outdated Prisma Client because Prisma's auto-generation isn't triggered. To fix this, make sure to run the \`prisma generate\` command during the build process.

    Learn how: https://pris.ly/d/netlify-build
  `)

  expect(consoleMock.mock.calls[0]).toMatchInlineSnapshot(`
    [
      Prisma has detected that this project was built on Vercel, which caches dependencies. This leads to an outdated Prisma Client because Prisma's auto-generation isn't triggered. To fix this, make sure to run the \`prisma generate\` command during the build process.

    Learn how: https://pris.ly/d/vercel-build,
    ]
  `)
})

test('generated on netlify', () => {
  const consoleMock = jest.spyOn(console, 'error').mockImplementation()

  expect(() => checkPlatformCaching({ postinstall: false, ciName: 'Netlify CI', clientVersion: '0.0.0' })).not.toThrow()
  expect(consoleMock.mock.calls[0]).toMatchInlineSnapshot(`
    [
      Prisma has detected that this project was built on Vercel, which caches dependencies. This leads to an outdated Prisma Client because Prisma's auto-generation isn't triggered. To fix this, make sure to run the \`prisma generate\` command during the build process.

    Learn how: https://pris.ly/d/vercel-build,
    ]
  `)
})

test('error is a PrismaClientInitializationError', () => {
  const consoleMock = jest.spyOn(console, 'error').mockImplementation()

  try {
    checkPlatformCaching({ postinstall: true, ciName: 'Netlify CI', clientVersion: '0.0.0' })
  } catch (e) {
    expect(e).toBeInstanceOf(PrismaClientInitializationError)
    expect(consoleMock.mock.calls[0]).toMatchInlineSnapshot(`
      [
        Prisma has detected that this project was built on Vercel, which caches dependencies. This leads to an outdated Prisma Client because Prisma's auto-generation isn't triggered. To fix this, make sure to run the \`prisma generate\` command during the build process.

      Learn how: https://pris.ly/d/vercel-build,
      ]
    `)
  }
})

export {}
