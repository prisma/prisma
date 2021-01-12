import { getTestClient } from '../../../../utils/getTestClient'
const cases = {
  contructor: {
    customError: new Error('Contructor Custom Error'),
    customErrorPerModel: {
      User: new Error('Contructor Custom Error on User'),
    },
    thunk: () => new Error('Contructor Thunk'),
    true: true,
    false: false,
    undefined: undefined,
  },
  methods: {
    findUnique: {
      customError: new Error('FindUnique Custom Error'),
      thunk: () => new Error('FindUnique Thunk'),
      true: true,
      false: false,
      undefined: undefined,
    },
    findFirst: {
      customError: new Error('FindFirst Custom Error'),
      thunk: () => new Error('FindFirst Thunk'),
      true: true,
      false: false,
      undefined: undefined,
    },
  },
}
for (const constructorKey of Object.keys(cases.contructor)) {
  const constructor = cases.contructor[constructorKey]
  for (const method of Object.keys(cases.methods)) {
    const currentMethod = cases.methods[method]
    for (const valueKey of Object.keys(currentMethod)) {
      const value = currentMethod[valueKey]
      test(`rejectOnNotFound contructor=${constructorKey} ${method}=${value}`, async () => {
        // It should fail or not
        expect.assertions(1)
        const PrismaClient = await getTestClient()
        const prisma = new PrismaClient({
          rejectOnNotFound: constructor,
        })

        // Test Rejection
        try {
          const r = await prisma.user.findUnique({
            where: { id: 'none' },
            rejectOnNotFound: value,
          })
          expect(r).toMatchSnapshot()
        } catch (error) {
          expect(error).toMatchSnapshot()
        }
        prisma.$disconnect()
      })
    }
  }
}
