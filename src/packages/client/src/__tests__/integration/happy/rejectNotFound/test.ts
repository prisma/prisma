import { isError } from '@prisma/sdk'
import { getTestClient } from '../../../../utils/getTestClient'
const cases = {
  constructor: {
    customError: new Error('Constructor Custom Error'),
    booleanPerAction: {
      findUnique: true,
      findFirst: false,
    },
    thunkPerAction: {
      findFirst: () => new Error('Constructor Thunk on findFirst'),
      findUnique: (err) => err
    },
    errorPerAction: {
      findFirst: Error('Constructor Error on findFirst'),
      findUnique: Error('Constructor Error on findUnique'),
    },
    customErrorPerActionPerModel: {
      findFirst: {
        User: new Error('Constructor Custom Error on findFirst:User')
      },
      findUnique: {
        User: () => new Error('Constructor Thunk on findUnique:User')
      },
    },
    thunk: () => new Error('Constructor Thunk'),
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

for (const constructorKey of Object.keys(cases.constructor)) {
  const constructor = cases.constructor[constructorKey]
  for (const method of Object.keys(cases.methods)) {
    const currentMethod = cases.methods[method]
    for (const valueKey of Object.keys(currentMethod)) {
      const value = currentMethod[valueKey]
      test(`rejectOnNotFound | constructor=${constructorKey} | ${method}=${value}`, async () => {
        // It should fail or not
        expect.assertions(1)
        const PrismaClient = await getTestClient()
        const prisma = new PrismaClient({
          rejectOnNotFound: constructor,
        })

        // Test Rejection
        try {
          const r = await prisma.user[method]({
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
