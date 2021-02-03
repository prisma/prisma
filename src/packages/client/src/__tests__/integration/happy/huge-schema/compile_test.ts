
import { PrismaClient } from  '@prisma/client'
const client = new PrismaClient();

async function main(){
  const a = await client.a.findMany()
}
