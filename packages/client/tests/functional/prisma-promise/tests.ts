import testMatrix from './_matrix'
import { faker } from '@faker-js/faker'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(() => {
  describe('create', () => {
    const createPromise = () => {
      const email = faker.internet.email()

      return prisma.user.create({
        data: {
          email,
        },
      })
    }

    test('repeated calls to .then', async () => {
      const promise = createPromise()

      // repeated calls to then should not change the result
      const res1 = await promise.then()
      const res2 = await promise.then()

      expect(res1).toStrictEqual(res2)
    })

    test('repeated calls to .catch', async () => {
      const promise = createPromise()

      // repeated calls to catch should not change the result
      const res1 = await promise.catch()
      const res2 = await promise.catch()

      expect(res1).toStrictEqual(res2)
    })

    test('repeated calls to .finally', async () => {
      const promise = createPromise()

      // repeated calls to finally should not change the result
      const res1 = await promise.finally()
      const res2 = await promise.finally()

      expect(res1).toStrictEqual(res2)
    })

    test('repeated mixed calls to .then, .catch, .finally', async () => {
      const promise = createPromise()

      // repeated calls to then & co should not change the result
      const res1 = await promise.finally().then().catch()
      const res2 = await promise.catch().finally().then()

      expect(res1).toStrictEqual(res2)
    })

    test('repeated calls to .requestTransaction', async () => {
      const promise = createPromise()

      // repeated calls to then & co should not change the result
      const res1 = await promise.requestTransaction(1)
      const res2 = await promise.requestTransaction(1)

      expect(res1).toStrictEqual(res2)
    })

    test('fluent promises should have promise properties', async () => {
      const promise = createPromise()

      expect('then' in promise).toBe(true)
      expect('finally' in promise).toBe(true)
      expect('catch' in promise).toBe(true)

      await promise.finally()
    })
  })

  describe('find', () => {
    const createPromise = () => {
      const email = faker.internet.email()

      return prisma.user.findMany({
        where: {
          email,
        },
      })
    }

    test('repeated calls to .then', async () => {
      const promise = createPromise()

      // repeated calls to then should not change the result
      const res1 = await promise.then()
      const res2 = await promise.then()

      expect(res1).toStrictEqual(res2)
    })

    test('repeated calls to .catch', async () => {
      const promise = createPromise()

      // repeated calls to catch should not change the result
      const res1 = await promise.catch()
      const res2 = await promise.catch()

      expect(res1).toStrictEqual(res2)
    })

    test('repeated calls to .finally', async () => {
      const promise = createPromise()

      // repeated calls to finally should not change the result
      const res1 = await promise.finally()
      const res2 = await promise.finally()

      expect(res1).toStrictEqual(res2)
    })

    test('repeated mixed calls to .then, .catch, .finally', async () => {
      const promise = createPromise()

      // repeated calls to then & co should not change the result
      const res1 = await promise.finally().then().catch()
      const res2 = await promise.catch().finally().then()

      expect(res1).toStrictEqual(res2)
    })

    test('repeated calls to .requestTransaction', async () => {
      const promise = createPromise()

      // repeated calls to then & co should not change the result
      const res1 = await promise.requestTransaction(1)
      const res2 = await promise.requestTransaction(1)

      expect(res1).toStrictEqual(res2)
    })

    test('fluent promises should have promise properties', async () => {
      const promise = createPromise()

      expect('then' in promise).toBe(true)
      expect('finally' in promise).toBe(true)
      expect('catch' in promise).toBe(true)

      await promise.finally()
    })
  })

  describe('update', () => {
    const email = faker.internet.email()

    const createPromise = () => {
      return prisma.user.update({
        where: {
          email,
        },
        data: {
          email,
        },
      })
    }

    beforeAll(async () => {
      await prisma.user.create({
        data: {
          email,
        },
      })
    })

    test('repeated calls to .then', async () => {
      const promise = createPromise()

      // repeated calls to then should not change the result
      const res1 = await promise.then()
      const res2 = await promise.then()

      expect(res1).toStrictEqual(res2)
    })

    test('repeated calls to .catch', async () => {
      const promise = createPromise()

      // repeated calls to catch should not change the result
      const res1 = await promise.catch()
      const res2 = await promise.catch()

      expect(res1).toStrictEqual(res2)
    })

    test('repeated calls to .finally', async () => {
      const promise = createPromise()

      // repeated calls to finally should not change the result
      const res1 = await promise.finally()
      const res2 = await promise.finally()

      expect(res1).toStrictEqual(res2)
    })

    test('repeated mixed calls to .then, .catch, .finally', async () => {
      const promise = createPromise()

      // repeated calls to then & co should not change the result
      const res1 = await promise.finally().then().catch()
      const res2 = await promise.catch().finally().then()

      expect(res1).toStrictEqual(res2)
    })

    test('repeated calls to .requestTransaction', async () => {
      const promise = createPromise()

      // repeated calls to then & co should not change the result
      const res1 = await promise.requestTransaction(1)
      const res2 = await promise.requestTransaction(1)

      expect(res1).toStrictEqual(res2)
    })

    test('fluent promises should have promise properties', async () => {
      const promise = createPromise()

      expect('then' in promise).toBe(true)
      expect('finally' in promise).toBe(true)
      expect('catch' in promise).toBe(true)

      await promise.finally()
    })
  })

  describe('delete', () => {
    const email = faker.internet.email()

    beforeEach(async () => {
      await prisma.user.create({
        data: {
          email,
        },
      })
    })

    const createPromise = () => {
      return prisma.user.delete({
        where: {
          email,
        },
      })
    }

    test('repeated calls to .then', async () => {
      const promise = createPromise()

      // repeated calls to then should not change the result
      const res1 = await promise.then()
      const res2 = await promise.then()

      expect(res1).toStrictEqual(res2)
    })

    test('repeated calls to .catch', async () => {
      const promise = createPromise()

      // repeated calls to catch should not change the result
      const res1 = await promise.catch()
      const res2 = await promise.catch()

      expect(res1).toStrictEqual(res2)
    })

    test('repeated calls to .finally', async () => {
      const promise = createPromise()

      // repeated calls to finally should not change the result
      const res1 = await promise.finally()
      const res2 = await promise.finally()

      expect(res1).toStrictEqual(res2)
    })

    test('repeated mixed calls to .then, .catch, .finally', async () => {
      const promise = createPromise()

      // repeated calls to then & co should not change the result
      const res1 = await promise.finally().then().catch()
      const res2 = await promise.catch().finally().then()

      expect(res1).toStrictEqual(res2)
    })

    test('repeated calls to .requestTransaction', async () => {
      const promise = createPromise()

      // repeated calls to then & co should not change the result
      const res1 = await promise.requestTransaction(1)
      const res2 = await promise.requestTransaction(1)

      expect(res1).toStrictEqual(res2)
    })

    test('fluent promises should have promise properties', async () => {
      const promise = createPromise()

      expect('then' in promise).toBe(true)
      expect('finally' in promise).toBe(true)
      expect('catch' in promise).toBe(true)

      await promise.finally()
    })
  })
})
