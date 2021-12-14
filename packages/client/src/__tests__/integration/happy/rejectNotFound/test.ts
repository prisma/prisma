import { getTestClient } from '../../../../utils/getTestClient'
const cases = {
  constructor: {
    customError: () => new Error('Constructor Custom Error'),
    truePerAction: {
      findUnique: true,
      findFirst: true,
    },
    falsePerAction: {
      findUnique: false,
      findFirst: false,
    },
    errorPerAction: {
      findFirst: () => new Error('Constructor Error on findFirst'),
      findUnique: () => new Error('Constructor Error on findUnique'),
    },
    customErrorPerActionPerModel: {
      findFirst: {
        User: () => new Error('Constructor Custom Error on findFirst:User'),
      },
      findUnique: {
        User: () => new Error('Constructor Thunk on findUnique:User'),
      },
    },
    true: true,
    false: false,
    undefined: undefined,
  },
  methods: {
    findUnique: {
      customError: () => new Error('FindUnique Custom Error'),
      true: true,
      false: false,
      undefined: undefined,
    },
    findFirst: {
      customError: () => new Error('FindFirst Custom Error'),
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
        const PrismaClient = await getTestClient()
        const prisma = new PrismaClient({
          rejectOnNotFound: constructor,
        })

        // This function name is important cause we're searching
        // for it's name in the stack bellow
        const testRejectionOnNotFound = async () => {
          const r = await prisma.user[method]({
            where: { id: 'none' },
            rejectOnNotFound: value,
          })

          // If it got to here, then no error was thrown
          // so we check the value if it's equal to null
          expect(r).toBeNull()
        }

        try {
          await testRejectionOnNotFound()
        } catch (error) {
          const { message, stack }: { message: string; stack: string } = error
          expect(stack).toBeDefined()
          expect(message).toBeDefined()

          // Checking for the most important parts in the stack trace
          // 1. The "ErrorName: ErrorMsg"
          // 2. The function name that the error was thrown from
          const isCustomError = error.name === 'NotFoundError'

          if (isCustomError) {
            expect(stack.includes(`NotFoundError: ${error.message}`)).toBeTruthy()
          } else {
            expect(stack.includes(`Error: ${error.message}`)).toBeTruthy()
          }
          expect(stack.includes('at testRejectionOnNotFound')).toBeTruthy()
        }
        await prisma.$disconnect()
      })
    }
  }
}
