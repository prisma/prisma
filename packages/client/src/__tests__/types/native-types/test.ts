import { PrismaClient, Prisma } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()

  const bint: bigint = BigInt(0)

  const a: null | {
    id: string
    email: string
    name: string | null
    int: number
    sInt: number
    bInt: bigint
    // serial: number
    // sSerial: number
    // bSerial: number
    inc_int: number
    inc_sInt: number
    inc_bInt: bigint
  } = await prisma.a.findFirst({
    where: {
      inc_bInt: {
        in: [bint],
      },
    },
  })

  const b = await prisma.b.findFirst({
    where: {
      decFloat: new Prisma.Decimal('1.23'),
      OR: [
        {
          decFloat: '1.23',
        },
        {
          decFloat: 1.23,
        },
      ],
    },
  })
  const c = await prisma.c.findFirst()
  const d: null | {
    id: string
    bool: boolean
    byteA: Buffer
    xml: string
    json: Prisma.JsonValue
    jsonb: Prisma.JsonValue
  } = await prisma.d.findFirst()
  const e = await prisma.e.findFirst()
}

main()
