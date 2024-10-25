import { PrismaClient } from '.prisma/client'

async function main() {
  const prisma = new PrismaClient()

  const email = `user.${Date.now()}@prisma.io`
  await prisma.user.create({
    data: {
      email: email,
    },
  })

  // @ts-ignore
  const query = prisma.$prepare(prisma.user.findMany());
  console.log("result", await query({ fieldA: "foo", fieldB: "bar" }));

  // @ts-ignore
  const query2 = prisma.$prepare(prisma.user.findFirst());
  console.log("result", await query2({ fieldA: "foo", fieldB: "bar" }));

  // console.log(users)
}

void main().catch((e) => {
  console.log(e.message)
  process.exit(1)
})
