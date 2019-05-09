import { Prisma } from './generated'

async function main() {
  console.clear()
  const prisma = new Prisma()
  const result = await prisma.query({
    posts: {
      after: '',
      first: '2100',
      last: 200,
      select: {
        id: false,
        author: {
          id: true,
          select: {
            id: '',
            lame: false,
            posts: {
              select: {
                id: true,
                mid: false,
              },
            },
          },
        },
      },
    } as any,
  })
  console.log(result)
}

main().catch(console.error)
