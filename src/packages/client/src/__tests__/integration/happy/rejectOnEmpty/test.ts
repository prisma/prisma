import { getTestClient } from '../../../../utils/getTestClient'
const cases = {
  contructor: {
    customError: new Error('Contructor Custom Error'),
    customErrorPerModel: {
      User: new Error('Contructor Custom Error on User'),
    },
    true: true,
    false: false,
    undefined: undefined
  },
  findUnique: {
    customError: new Error('FindUnique Custom Error'),
    true: true,
    false: false,
    undefined: undefined
  }
}
for (const constructorKey of Object.keys(cases.contructor)) {
  const constructor = cases.contructor[constructorKey]
  for (const findUniqueKey of Object.keys(cases.findUnique)) {
    const  findUnique = cases.findUnique[ findUniqueKey]
    test(`rejectOnEmpty contructor=${constructorKey} findUnique=${findUniqueKey}`, async () => {
      // It should fail or not
      expect.assertions(1)
      const PrismaClient = await getTestClient()
      const prisma = new PrismaClient({
        rejectOnEmpty: constructor
      })

      // Test Rejection
      try {
        const r = await prisma.user.findUnique({
          where: {id: 'none'},
          rejectOnEmpty: findUnique
        })
        expect(r).toMatchSnapshot()
      } catch (error) {
        expect(error).toMatchSnapshot()
      }
      prisma.$disconnect()
    })
    
  }
}
