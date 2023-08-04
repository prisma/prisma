import { PrismaClient } from '.prisma/client'

async function main() {
  const prisma = new PrismaClient({
    log: ['query']
  })

  await prisma.test_table_a.findMany({
    where: {
      test_table_b: {
        time_created: {
          gt: new Date(),
        },
      },
    },
    orderBy: {
      test_table_b: {
        time_created: "asc",
      },
    },
  });
}

void main().catch((e) => {
  console.log(e.message)
  process.exit(1)
})
