import { randomBytes } from 'crypto'
import { A, Test, U } from 'ts-toolbelt'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

const nonExistingId = randomBytes(12).toString('hex')

testMatrix.setupTestSuite((suiteConfig, suiteMeta) => {
  test('findFirst', async () => {
    const result = await prisma.resource.findFirst().children()

    expect(result).toBeNull()
    ;() => Test.checks([Test.check<U.Has<typeof result, null>, 1, Test.Pass>()])
  })

  test('findUnique', async () => {
    const result = await prisma.resource.findUnique({ where: { id: nonExistingId } }).children()

    expect(result).toBeNull()
    ;() => Test.checks([Test.check<U.Has<typeof result, null>, 1, Test.Pass>()])
  })

  test('findFirstOrThrow', async () => {
    const result = prisma.resource.findFirstOrThrow().children()

    await expect(result).rejects.toThrowError()
    ;() => Test.checks([Test.check<U.Has<A.Await<typeof result>, null>, 0, Test.Pass>()])
  })

  test('findUniqueOrThrow', async () => {
    const result = prisma.resource.findUniqueOrThrow({ where: { id: nonExistingId } }).children()

    await expect(result).rejects.toThrowError()
    ;() => Test.checks([Test.check<U.Has<A.Await<typeof result>, null>, 0, Test.Pass>()])
  })

  test('create', async () => {
    const result = await prisma.resource.create({ data: {} }).children()

    await prisma.resource.deleteMany()

    expect(result).toStrictEqual([])
    ;() => Test.checks([Test.check<U.Has<typeof result, null>, 0, Test.Pass>()])
  })

  test('update', async () => {
    const result = prisma.resource.update({ where: { id: nonExistingId }, data: {} }).children()

    await expect(result).rejects.toThrowError()
    ;() => Test.checks([Test.check<U.Has<A.Await<typeof result>, null>, 0, Test.Pass>()])
  })

  test('upsert', async () => {
    const result = await prisma.resource.upsert({ where: { id: nonExistingId }, update: {}, create: {} }).children()

    await prisma.resource.deleteMany()

    expect(result).toStrictEqual([])
    ;() => Test.checks([Test.check<U.Has<typeof result, null>, 0, Test.Pass>()])
  })

  test('findFirst with select', async () => {
    const result = await prisma.resource.findFirst().children({
      select: {
        id: true,
      },
    })

    expect(result).toBeNull()
    ;() => Test.checks([Test.check<U.Has<typeof result, null>, 1, Test.Pass>()])
  })

  test('findUnique with select', async () => {
    const result = await prisma.resource.findUnique({ where: { id: nonExistingId } }).children({
      select: {
        id: true,
      },
    })

    expect(result).toBeNull()
    ;() => Test.checks([Test.check<U.Has<typeof result, null>, 1, Test.Pass>()])
  })

  test('findFirstOrThrow with select', async () => {
    const result = prisma.resource.findFirstOrThrow().children({
      select: {
        id: true,
      },
    })

    await expect(result).rejects.toThrowError()
    ;() => Test.checks([Test.check<U.Has<A.Await<typeof result>, null>, 0, Test.Pass>()])
  })

  test('findUniqueOrThrow with select', async () => {
    const result = prisma.resource.findUniqueOrThrow({ where: { id: nonExistingId } }).children({
      select: {
        id: true,
      },
    })

    await expect(result).rejects.toThrowError()
    ;() => Test.checks([Test.check<U.Has<A.Await<typeof result>, null>, 0, Test.Pass>()])
  })

  test('create with select', async () => {
    const result = await prisma.resource.create({ data: {} }).children({
      select: {
        id: true,
      },
    })

    await prisma.resource.deleteMany()

    expect(result).toStrictEqual([])
    ;() => Test.checks([Test.check<U.Has<typeof result, null>, 0, Test.Pass>()])
  })

  test('update with select', async () => {
    const result = prisma.resource.update({ where: { id: nonExistingId }, data: {} }).children({
      select: {
        id: true,
      },
    })

    await expect(result).rejects.toThrowError()
    ;() => Test.checks([Test.check<U.Has<A.Await<typeof result>, null>, 0, Test.Pass>()])
  })

  test('upsert with select', async () => {
    const result = await prisma.resource.upsert({ where: { id: nonExistingId }, update: {}, create: {} }).children({
      select: {
        id: true,
      },
    })

    await prisma.resource.deleteMany()

    expect(result).toStrictEqual([])
    ;() => Test.checks([Test.check<U.Has<typeof result, null>, 0, Test.Pass>()])
  })

  test('findFirst with include', async () => {
    const result = await prisma.resource.findFirst().children({
      include: {
        parent: true,
      },
    })

    expect(result).toBeNull()
    ;() => Test.checks([Test.check<U.Has<typeof result, null>, 1, Test.Pass>()])
  })

  test('findUnique with include', async () => {
    const result = await prisma.resource.findUnique({ where: { id: nonExistingId } }).children({
      include: {
        parent: true,
      },
    })

    expect(result).toBeNull()
    ;() => Test.checks([Test.check<U.Has<typeof result, null>, 1, Test.Pass>()])
  })

  test('findFirstOrThrow with include', async () => {
    const result = prisma.resource.findFirstOrThrow().children({
      include: {
        parent: true,
      },
    })

    await expect(result).rejects.toThrowError()
    ;() => Test.checks([Test.check<U.Has<A.Await<typeof result>, null>, 0, Test.Pass>()])
  })

  test('findUniqueOrThrow with include', async () => {
    const result = prisma.resource.findUniqueOrThrow({ where: { id: nonExistingId } }).children({
      include: {
        parent: true,
      },
    })

    await expect(result).rejects.toThrowError()
    ;() => Test.checks([Test.check<U.Has<A.Await<typeof result>, null>, 0, Test.Pass>()])
  })

  test('create with include', async () => {
    const result = await prisma.resource.create({ data: {} }).children({
      include: {
        parent: true,
      },
    })

    await prisma.resource.deleteMany()

    expect(result).toStrictEqual([])
    ;() => Test.checks([Test.check<U.Has<typeof result, null>, 0, Test.Pass>()])
  })

  test('update with include', async () => {
    const result = prisma.resource.update({ where: { id: nonExistingId }, data: {} }).children({
      include: {
        parent: true,
      },
    })

    await expect(result).rejects.toThrowError()
    ;() => Test.checks([Test.check<U.Has<A.Await<typeof result>, null>, 0, Test.Pass>()])
  })

  test('upsert with include', async () => {
    const result = await prisma.resource.upsert({ where: { id: nonExistingId }, update: {}, create: {} }).children({
      include: {
        parent: true,
      },
    })

    await prisma.resource.deleteMany()

    expect(result).toStrictEqual([])
    ;() => Test.checks([Test.check<U.Has<typeof result, null>, 0, Test.Pass>()])
  })

  test('findFirst with rejectOnNotFound', async () => {
    const result = await prisma.resource.findFirst({ rejectOnNotFound: true }).children()

    expect(result).toBeNull()
    ;() => Test.checks([Test.check<U.Has<typeof result, null>, 0, Test.Pass>()])
  })

  test('findUnique with rejectOnNotFound', async () => {
    const result = await prisma.resource.findUnique({ where: { id: nonExistingId }, rejectOnNotFound: true }).children()

    expect(result).toBeNull()
    ;() => Test.checks([Test.check<U.Has<typeof result, null>, 0, Test.Pass>()])
  })
})
