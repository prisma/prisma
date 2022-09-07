import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

/**
 * Regression test for #12063
 */
testMatrix.setupTestSuite((suiteConfig, suiteMeta) => {
  beforeAll(async () => {
    await prisma.resource.create({ data: {} })
  })

  test('findFirst with empty where ', async () => {
    const data = await prisma.resource.findFirst({ where: {} })

    expect(data).not.toBeNull()
  })

  test('findFirst with WHERE + empty AND', async () => {
    const data = await prisma.resource.findFirst({
      where: {
        AND: {},
      },
    })

    expect(data).not.toBeNull()
  })

  test.failing('findFirst with WHERE + empty OR', async () => {
    const data = await prisma.resource.findFirst({
      where: {
        OR: {},
      },
    })

    expect(data).not.toBeNull()
  })

  test.failing('findFirst with WHERE + empty AND in OR', async () => {
    const data = await prisma.resource.findFirst({
      where: {
        OR: {
          AND: {},
        },
      },
    })

    expect(data).not.toBeNull()
  })

  test('findFirst with WHERE + empty OR in AND', async () => {
    const data = await prisma.resource.findFirst({
      where: {
        AND: {
          OR: {},
        },
      },
    })

    expect(data).not.toBeNull()
  })

  test.failing('findFirst with WHERE + empty OR list', async () => {
    const data = await prisma.resource.findFirst({
      where: {
        OR: [],
      },
    })

    expect(data).not.toBeNull()
  })

  test.failing('findFirst with WHERE + empty AND list in OR', async () => {
    const data = await prisma.resource.findFirst({
      where: {
        OR: {
          AND: [],
        },
      },
    })

    expect(data).not.toBeNull()
  })

  test.failing('findFirst with WHERE + empty AND in OR list', async () => {
    const data = await prisma.resource.findFirst({
      where: {
        OR: [
          {
            AND: {},
          },
        ],
      },
    })

    expect(data).not.toBeNull()
  })

  test.failing('findFirst with WHERE + empty AND list in OR list', async () => {
    const data = await prisma.resource.findFirst({
      where: {
        OR: [
          {
            AND: [],
          },
        ],
      },
    })

    expect(data).not.toBeNull()
  })

  test('findFirst with WHERE + empty AND list', async () => {
    const data = await prisma.resource.findFirst({
      where: {
        AND: [],
      },
    })

    expect(data).not.toBeNull()
  })

  test('findFirst with WHERE + empty OR list in AND', async () => {
    const data = await prisma.resource.findFirst({
      where: {
        AND: {
          OR: [],
        },
      },
    })

    expect(data).not.toBeNull()
  })

  test('findFirst with WHERE + empty OR in AND list', async () => {
    const data = await prisma.resource.findFirst({
      where: {
        AND: [
          {
            OR: {},
          },
        ],
      },
    })

    expect(data).not.toBeNull()
  })

  test('findFirst with WHERE + empty OR list in AND list', async () => {
    const data = await prisma.resource.findFirst({
      where: {
        AND: [
          {
            OR: [],
          },
        ],
      },
    })

    expect(data).not.toBeNull()
  })

  test.failing('findFirst with WHERE + empty OR + empty object', async () => {
    const data = await prisma.resource.findFirst({
      where: {
        OR: {
          id: undefined,
        },
      },
    })

    expect(data).not.toBeNull()
  })

  test.failing('findFirst with WHERE + empty AND in OR + empty object', async () => {
    const data = await prisma.resource.findFirst({
      where: {
        OR: {
          AND: {
            id: undefined,
          },
        },
      },
    })

    expect(data).not.toBeNull()
  })

  test('findFirst with WHERE + empty OR in AND + empty object', async () => {
    const data = await prisma.resource.findFirst({
      where: {
        AND: {
          OR: {
            id: undefined,
          },
        },
      },
    })

    expect(data).not.toBeNull()
  })

  test.failing('findFirst with WHERE + empty OR list + empty object', async () => {
    const data = await prisma.resource.findFirst({
      where: {
        OR: [
          {
            id: undefined,
          },
        ],
      },
    })

    expect(data).not.toBeNull()
  })

  test.failing('findFirst with WHERE + empty AND list in OR + empty object', async () => {
    const data = await prisma.resource.findFirst({
      where: {
        OR: {
          AND: [
            {
              id: undefined,
            },
          ],
        },
      },
    })

    expect(data).not.toBeNull()
  })

  test.failing('findFirst with WHERE + empty AND in OR list + empty object', async () => {
    const data = await prisma.resource.findFirst({
      where: {
        OR: [
          {
            AND: {
              id: undefined,
            },
          },
        ],
      },
    })

    expect(data).not.toBeNull()
  })

  test.failing('findFirst with WHERE + empty AND list in OR list + empty object', async () => {
    const data = await prisma.resource.findFirst({
      where: {
        OR: [
          {
            AND: [
              {
                id: undefined,
              },
            ],
          },
        ],
      },
    })

    expect(data).not.toBeNull()
  })

  test('findFirst with WHERE + empty AND list + empty object', async () => {
    const data = await prisma.resource.findFirst({
      where: {
        AND: [
          {
            id: undefined,
          },
        ],
      },
    })

    expect(data).not.toBeNull()
  })

  test('findFirst with WHERE + empty OR list in AND + empty object', async () => {
    const data = await prisma.resource.findFirst({
      where: {
        AND: {
          OR: [
            {
              id: undefined,
            },
          ],
        },
      },
    })

    expect(data).not.toBeNull()
  })

  test('findFirst with WHERE + empty OR in AND list + empty object', async () => {
    const data = await prisma.resource.findFirst({
      where: {
        AND: [
          {
            OR: {
              id: undefined,
            },
          },
        ],
      },
    })

    expect(data).not.toBeNull()
  })

  test('findFirst with WHERE + empty OR list in AND list + empty object', async () => {
    const data = await prisma.resource.findFirst({
      where: {
        AND: [
          {
            OR: [
              {
                id: undefined,
              },
            ],
          },
        ],
      },
    })

    expect(data).not.toBeNull()
  })
})
