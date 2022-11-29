import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient //TODO: make it PrismaClient after extension types are generated

testMatrix.setupTestSuite(() => {
  test('extend specific model', () => {
    const extMethod = jest.fn()
    const xprisma = prisma.$extends({
      model: {
        user: {
          extMethod,
        },
      },
    })

    xprisma.user.extMethod()

    expect(extMethod).toHaveBeenCalledTimes(1)
    expect((xprisma.post as any).extMethod).toBeUndefined()
  })

  test('extend all models', () => {
    const extMethod = jest.fn()
    const xprisma = prisma.$extends({
      model: {
        $allModels: {
          extMethod,
        },
      },
    })

    xprisma.user.extMethod()
    xprisma.post.extMethod()

    expect(extMethod).toHaveBeenCalledTimes(2)
  })

  test('pass arguments to ext method', () => {
    const extMethod = jest.fn()
    const xprisma = prisma.$extends({
      model: {
        user: {
          extMethod,
        },
      },
    })

    xprisma.user.extMethod('hello', 'world')
    expect(extMethod).toHaveBeenCalledWith('hello', 'world')
  })

  test('return value to ext method', () => {
    const extMethod = jest.fn().mockReturnValue('hi!')
    const xprisma = prisma.$extends({
      model: {
        user: {
          extMethod,
        },
      },
    })

    expect(xprisma.user.extMethod()).toBe('hi!')
  })

  test('specific model extension has precedence over $allModels', () => {
    const genericMethod = jest.fn()
    const specificMethod = jest.fn()
    const xprisma = prisma.$extends({
      model: {
        $allModels: {
          extMethod: genericMethod,
        },
        user: {
          extMethod: specificMethod,
        },
      },
    })

    xprisma.user.extMethod()

    expect(specificMethod).toHaveBeenCalled()
    expect(genericMethod).not.toHaveBeenCalled()
  })

  test('last extension takes precedence over earlier ones', () => {
    const firstMethod = jest.fn()
    const secondMethod = jest.fn()
    const xprisma = prisma
      .$extends({
        model: {
          user: {
            extMethod: firstMethod,
          },
        },
      })
      .$extends({
        model: {
          user: {
            extMethod: secondMethod,
          },
        },
      })

    xprisma.user.extMethod()

    expect(secondMethod).toHaveBeenCalled()
    expect(firstMethod).not.toHaveBeenCalled()
  })

  test('allows to override built-in methods', async () => {
    const extMethod = jest.fn()
    const xprisma = prisma.$extends({
      model: {
        user: {
          findFirst: extMethod,
        },
      },
    })

    await xprisma.user.findFirst({})

    expect(extMethod).toHaveBeenCalled()
  })

  test('non-conflicting extensions can co-exist', () => {
    const firstMethod = jest.fn()
    const secondMethod = jest.fn()
    const xprisma = prisma
      .$extends({
        model: {
          user: {
            firstMethod,
          },
        },
      })
      .$extends({
        model: {
          user: {
            secondMethod,
          },
        },
      })

    xprisma.user.firstMethod()
    xprisma.user.secondMethod()

    expect(firstMethod).toHaveBeenCalled()
    expect(secondMethod).toHaveBeenCalled()
  })

  test('extension methods can call each other', () => {
    const helper = jest.fn()
    const xprisma = prisma.$extends({
      model: {
        user: {
          helper,
          extMethod() {
            this.helper()
          },
        },
      },
    })

    xprisma.user.extMethod()
    expect(helper).toHaveBeenCalled()
  })

  test('extension methods can call model methods', async () => {
    const xprisma = prisma.$extends({
      model: {
        user: {
          // TODO: remove any once types are generated
          myFind(this: any) {
            return this.findMany({})
          },
        },
      },
    })

    const users = await xprisma.user.myFind()
    expect(users).toEqual([])
  })

  // TODO: we should align compile and run- time behavior here: this
  // should either be valid in both cases, or error in both cases. Right now,
  // it works in runtime but we are not sure we can make it work on a type level
  // https://github.com/prisma/client-planning/issues/108
  test('extension methods can call methods of other extensions', () => {
    const firstMethod = jest.fn()
    const xprisma = prisma
      .$extends({
        model: {
          user: {
            firstMethod,
          },
        },
      })
      .$extends({
        model: {
          user: {
            // TODO: remove any once types are generated
            secondMethod(this: any) {
              this.firstMethod()
            },
          },
        },
      })

    xprisma.user.secondMethod()

    expect(firstMethod).toHaveBeenCalled()
  })

  test('error in extension methods', () => {
    const xprisma = prisma.$extends({
      name: 'Faulty model',
      model: {
        user: {
          fail() {
            throw new Error('Fail!')
          },
        },
      },
    })

    expect(() => xprisma.user.fail()).toThrowErrorMatchingInlineSnapshot(
      `Error caused by extension "Faulty model": Fail!`,
    )
  })

  test('error in async methods', async () => {
    const xprisma = prisma.$extends({
      name: 'Faulty model',
      model: {
        user: {
          fail() {
            return Promise.reject(new Error('Fail!'))
          },
        },
      },
    })

    await expect(xprisma.user.fail()).rejects.toThrowErrorMatchingInlineSnapshot(
      `Error caused by extension "Faulty model": Fail!`,
    )
  })

  test('error in extension methods without name', () => {
    const xprisma = prisma.$extends({
      model: {
        user: {
          fail() {
            throw new Error('Fail!')
          },
        },
      },
    })

    expect(() => xprisma.user.fail()).toThrowErrorMatchingInlineSnapshot(`Error caused by an extension: Fail!`)
  })
})
