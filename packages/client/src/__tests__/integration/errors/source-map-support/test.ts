import 'source-map-support/register'

import { generateTestClient } from '../../../../utils/getTestClient'

/* eslint-disable */
// X is here to have a different line count in the transpiled js and ts
type X = {}

test('source-map-support', async () => {
  await generateTestClient()
  const PrismaClient = require('./node_modules/@prisma/client').PrismaClient
  const prisma = new PrismaClient()

  await expect(
    prisma
      .$connect()
      .catch((err) => {
        console.log(err)
      })
      .then(() => {
        return prisma.user.findUnique({ where: { id: null as any } })
      }),
  ).rejects.toMatchSnapshot()

  await prisma.$disconnect()
})
