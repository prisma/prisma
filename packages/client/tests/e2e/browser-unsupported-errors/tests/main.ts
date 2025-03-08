import { Prisma } from '@prisma/client/index-browser'

describe('import from browser bundle should error', () => {
  test('Prisma.sql', () => {
    expect(Prisma.sql).toThrow(
      'sqltag is unable to run in this browser environment, or has been bundled for the browser',
    )
  })
  test('Prisma.empty', () => {
    expect(Prisma.empty).toThrow(
      'empty is unable to run in this browser environment, or has been bundled for the browser',
    )
  })
  test('Prisma.join', () => {
    expect(Prisma.join).toThrow(
      'join is unable to run in this browser environment, or has been bundled for the browser',
    )
  })
  test('Prisma.raw', () => {
    expect(Prisma.raw).toThrow('raw is unable to run in this browser environment, or has been bundled for the browser')
  })

  test('Prisma.PrismaClientKnownRequestError', () => {
    expect(Prisma.PrismaClientKnownRequestError).toThrow(
      'PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser',
    )
  })
  test('Prisma.PrismaClientUnknownRequestError', () => {
    expect(Prisma.PrismaClientUnknownRequestError).toThrow(
      'PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser',
    )
  })
  test('Prisma.PrismaClientRustPanicError', () => {
    expect(Prisma.PrismaClientRustPanicError).toThrow(
      'PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser',
    )
  })
  test('Prisma.PrismaClientInitializationError', () => {
    expect(Prisma.PrismaClientInitializationError).toThrow(
      'PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser',
    )
  })
  test('Prisma.PrismaClientValidationError', () => {
    expect(Prisma.PrismaClientValidationError).toThrow(
      'PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser',
    )
  })

  test('Prisma.getExtensionContext', () => {
    expect(Prisma.getExtensionContext).toThrow(
      'getExtensionContext is unable to run in this browser environment, or has been bundled for the browser',
    )
  })
  test('Prisma.defineExtension', () => {
    expect(Prisma.defineExtension).toThrow(
      'defineExtension is unable to run in this browser environment, or has been bundled for the browser',
    )
  })
})
