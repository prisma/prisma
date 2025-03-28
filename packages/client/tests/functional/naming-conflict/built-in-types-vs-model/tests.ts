import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

function uncapitalize<T extends string>(s: T): Uncapitalize<T> {
  return (s[0].toLocaleLowerCase() + s.slice(1)) as Uncapitalize<T>
}

function assertModelKey(s: unknown): asserts s is keyof PrismaClient {
  if (typeof s !== 'string' || !(s in prisma)) {
    throw new Error(`Not a model key ${s}`)
  }
}

testMatrix.setupTestSuite(({ typeName }) => {
  beforeAll(async () => {
    const { id } = await prisma[typeName].create({
      data: {
        isUserProvidedType: true,
      },
    })

    await prisma.relationHolder.create({
      data: { modelId: id },
    })
  })

  test(`allows to use ${typeName} name for a model name`, async () => {
    const modelName = uncapitalize(typeName)
    assertModelKey(modelName)
    const result = await prisma[modelName].findFirstOrThrow()

    expect(result).toEqual({
      id: expect.any(String),
      isUserProvidedType: true,
    })

    expectTypeOf(result).not.toBeAny()
    expectTypeOf(result).toMatchTypeOf<{ id: string; isUserProvidedType: boolean }>()
  })

  test(`allows to use ${typeName} name for a model name (relation)`, async () => {
    const result = await prisma.relationHolder.findFirstOrThrow({
      include: { model: true },
    })

    expect(result.model).toEqual({
      id: expect.any(String),
      isUserProvidedType: true,
    })

    expectTypeOf(result.model).not.toBeAny()
    expectTypeOf(result.model).toMatchTypeOf<{ id: string; isUserProvidedType: boolean }>()
  })
})
