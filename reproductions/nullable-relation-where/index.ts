import { PrismaClient } from '.prisma/client'

async function main() {
  const prisma = new PrismaClient()

  /**
   * Imagine we have a job board app and users can assign themselves to a job.
   * We want to write a query to get all users with an active job.
   *
   * If we are querying where `activeJob` exists, it should not be nullable in the resulting type.
   */
  const usersWithJob = await prisma.user.findMany({
    include: { activeJob: true },
    where: {
      activeJob: {},
    },
  })

  console.log(usersWithJob[0].activeJob.description)

  /**
   * If not, it may be null.
   */
  const users = await prisma.user.findMany({
    include: { activeJob: true },
  })

  console.log(users[0].activeJob?.description)
}

void main().catch((e) => {
  console.log(e.message)
  process.exit(1)
})
