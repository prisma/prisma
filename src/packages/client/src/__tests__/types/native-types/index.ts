import { PrismaClient, JsonValue } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()

  const a = await prisma.a.findFirst()
  const b = await prisma.b.findFirst()
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
