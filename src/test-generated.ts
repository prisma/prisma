import { Prisma } from './generated'
import { performance } from 'perf_hooks'

async function main() {
  console.clear()
  const prisma = new Prisma()
  const before = performance.now()
  const result = await prisma.query({
    posts: {
      after: '',
      last: 200,
      select: {
        author: {
          select: {
            id: false,
          },
        },
      },
    },
  })
  console.log(`Took ${performance.now() - before}ms`)
  console.log(result)
}

main().catch(console.error)
