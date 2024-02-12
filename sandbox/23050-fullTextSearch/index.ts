import { PrismaClient } from '.prisma/client'

async function main() {
  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
    ]
  })

  await prisma.user.deleteMany({ })

  await prisma.user.createMany({
    data: [
      {
        firstName: 'Mary',
        lastName: '---',
      },
      {
        firstName: 'Jon',
        lastName: '---'
      },
      {
        firstName: 'Jon',
        lastName: 'Doe',
      },
      {
        firstName: 'Food',
        lastName: 'Bars',
      },
      {
        firstName: '---',
        lastName: 'Bar',
      },
    ]
  })

  prisma.$on('query', ({ query, params }) => {
    console.log('[query]', query)
    console.log('[params]', params)
  })

  const terms = ['jon', 'doe', 'foo', 'bar']

  const users = await prisma.user.findMany({
    where: {
      OR: [
        {
          firstName: {
            search: terms.join(' | '),
          },
        },
        {
          lastName: {
            search: terms.join(' | '),
          },
        },
      ],
    },
  })

  console.log('[users]')
  console.log(users)

  const usersRaw = await prisma.$queryRaw`
    SELECT "public"."User"."id", "public"."User"."firstName", "public"."User"."lastName"
    FROM "public"."User"
    WHERE to_tsvector("public"."User"."firstName") @@ to_tsquery(${terms.join(' | ')})
      OR to_tsvector("public"."User"."lastName") @@ to_tsquery(${terms.join(' | ')})
    ORDER BY "public"."User"."id" ASC;
  `

  console.log('[usersRaw]')
  console.log(usersRaw)
}

void main().catch((e) => {
  console.log(e.message)
  process.exit(1)
})
