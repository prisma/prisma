import { PrismaClient } from './generated/client'

export async function main() {
  const client = new PrismaClient()

  const data = await client.user.findMany()
  await client.$disconnect()
  return data
}
