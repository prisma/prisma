import 'source-map-support/register'

import { getQueryEngineProtocol } from '@prisma/internals'

import { getTestClient } from '../../../../utils/getTestClient'

/* eslint-disable */
// X is here to have a different line count in the transpiled js and ts
type X = {}
const testIf = (condition: boolean) => (condition ? test : test.skip)

testIf(getQueryEngineProtocol() !== 'json')('source-map-support', async () => {
  const PrismaClient = await getTestClient()
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
