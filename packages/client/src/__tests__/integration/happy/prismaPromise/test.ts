import { getTestClient } from '../../../../utils/getTestClient'

let prisma
describe('prismaPromise', () => {
  test('repeated calls to .then', async () => {
    const createPromise = prisma.user.create({
      data: {
        email: 'email@email.em',
      },
    })

    // repeated calls to then should not change the result
    const createResult1 = await createPromise.then()
    const createResult2 = await createPromise.then()

    expect(createResult1).toStrictEqual(createResult2)
  })

  test('repeated calls to .catch', async () => {
    const createPromise = prisma.user.create({
      data: {
        email: 'email@email.em',
      },
    })

    // repeated calls to catch should not change the result
    const createResult1 = await createPromise.catch()
    const createResult2 = await createPromise.catch()

    expect(createResult1).toStrictEqual(createResult2)
  })

  test('repeated calls to .finally', async () => {
    const createPromise = prisma.user.create({
      data: {
        email: 'email@email.em',
      },
    })

    // repeated calls to finally should not change the result
    const createResult1 = await createPromise.finally()
    const createResult2 = await createPromise.finally()

    expect(createResult1).toStrictEqual(createResult2)
  })

  test('repeated mixed calls to .then, .catch, .finally', async () => {
    const createPromise = prisma.user.create({
      data: {
        email: 'email@email.em',
      },
    })

    // repeated calls to then & co should not change the result
    const createResult1 = await createPromise.finally().then().catch()
    const createResult2 = await createPromise.catch().finally().then()

    expect(createResult1).toStrictEqual(createResult2)
  })

  test('repeated calls to .requestTransaction', async () => {
    const createPromise = prisma.user.create({
      data: {
        email: 'email@email.em',
      },
    })

    // repeated calls to then & co should not change the result
    const createResult1 = await createPromise.requestTransaction(1)
    const createResult2 = await createPromise.requestTransaction(1)

    expect(createResult1).toStrictEqual(createResult2)
  })

  beforeAll(async () => {
    const PrismaClient = await getTestClient()
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })
})
