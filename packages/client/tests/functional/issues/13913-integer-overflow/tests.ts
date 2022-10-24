import { get } from '../../../../../../helpers/blaze/get'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

const id = 'ac6be4a35f2ed6e94bb2928d'

testMatrix.setupTestSuite(({ provider }) => {
  test('int overflow', async () => {
    const result = prisma.resource.create({
      data: {
        id,
        number: 2265000000,
      },
    })

    const success = () => expect(result).resolves.toMatchSnapshot()
    const failure = () => expect(result).rejects.toMatchPrismaErrorSnapshot()

    await get(
      {
        postgresql: success,
        cockroachdb: success,
        mongodb: success,
        mysql: failure,
        sqlite: failure,
        sqlserver: failure,
      },
      provider,
    )()
  })
})
