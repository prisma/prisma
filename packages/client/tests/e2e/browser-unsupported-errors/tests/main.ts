import { Prisma } from '@prisma/client/index-browser'

describe('import from browser bundle should error', () => {
  test('Prisma.sql', () => {
    expect(Prisma.sql).toThrow(`sqltag was imported from`)
  })
  test('Prisma.empty', () => {
    expect(Prisma.empty).toThrow(`empty was imported from`)
  })
  test('Prisma.join', () => {
    expect(Prisma.join).toThrow(`join was imported from`)
  })
  test('Prisma.raw', () => {
    expect(Prisma.raw).toThrow(`raw was imported from`)
  })

  test('Prisma.PrismaClientKnownRequestError', () => {
    expect(Prisma.PrismaClientKnownRequestError).toThrow(`PrismaClientKnownRequestError was imported from`)
  })
  test('Prisma.PrismaClientUnknownRequestError', () => {
    expect(Prisma.PrismaClientUnknownRequestError).toThrow(`PrismaClientUnknownRequestError was imported from`)
  })
  test('Prisma.PrismaClientRustPanicError', () => {
    expect(Prisma.PrismaClientRustPanicError).toThrow(`PrismaClientRustPanicError was imported from`)
  })
  test('Prisma.PrismaClientInitializationError', () => {
    expect(Prisma.PrismaClientInitializationError).toThrow(`PrismaClientInitializationError was imported from`)
  })
  test('Prisma.PrismaClientValidationError', () => {
    expect(Prisma.PrismaClientValidationError).toThrow(`PrismaClientValidationError was imported from`)
  })
  test('Prisma.NotFoundError', () => {
    expect(Prisma.NotFoundError).toThrow(`NotFoundError was imported from`)
  })

  test('Prisma.getExtensionContext', () => {
    expect(Prisma.getExtensionContext).toThrow(`getExtensionContext was imported from`)
  })
  test('Prisma.defineExtension', () => {
    expect(Prisma.defineExtension).toThrow(`defineExtension was imported from`)
  })
})

export {}
