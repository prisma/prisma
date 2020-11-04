import { PrismaClient, JsonValue, Decimal } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()

  const a: null | {
    id: string
    email: string
    name: string | null
    int: number
    sInt: number
    bInt: BigInt
    serial: number
    sSerial: number
    bSerial: number
    inc_int: number
    inc_sInt: number
    inc_bInt: BigInt
  } = await prisma.a.findFirst()
  const b = await prisma.b.findFirst({
    where: {
      decFloat: new Decimal('1.23')
    }
  })
  const c = await prisma.c.findFirst()
  const d: null | {
    id: string
    bool: boolean
    byteA: Buffer
    xml: string
    json: JsonValue
    jsonb: JsonValue
  } = await prisma.d.findFirst()
  const e = await prisma.e.findFirst()

}

main()
