// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from '@prisma/client'

import testMatrix from './_matrix'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

// https://github.com/prisma/prisma/issues/15079
testMatrix.setupTestSuite(
  () => {
    // https://github.com/prisma/prisma/issues/15079#issuecomment-1232689729
    const data = {
      id_periode: 90,
    }

    test('should not throw an error when upserting a @db.Decimal(2, 0)', async () => {
      const created = await prisma.aktivasi_bku.upsert({
        where: {
          id: 'some-random-id',
        },
        create: data,
        update: data,
      })

      expect(created.id_periode).toEqual(new Prisma.Decimal(data.id_periode))

      const upserted = await prisma.aktivasi_bku.upsert({
        where: {
          id: created.id,
        },
        create: data,
        update: data,
      })

      expect(upserted).toMatchObject({ id: created.id, id_periode: new Prisma.Decimal(data.id_periode) })
    })
  },
  {
    optOut: {
      from: ['cockroachdb', 'mongodb', 'mysql', 'postgresql', 'sqlite'],
      reason: 'Only applicable to sqlserver',
    },
  },
)
