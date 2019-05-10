import { Prisma } from './generated'
import { performance } from 'perf_hooks'

async function main() {
  console.clear()
  const prisma = new Prisma()
  const before = performance.now()
  const result = await prisma.posts
    .create({
      data: {
        title: 'Title',
        content: 'Content',
        author: {
          create: {
            name: 'A name',
          },
        },
      },
    })
    .author()
  console.log(result)
  // const result = await prisma.posts
  //   .findOne({
  //     // name: true,
  //     where: {
  //       id: '6',
  //     },
  //   })
  //   .author()
  console.log(`Took ${performance.now() - before}ms`)
  // console.log(result)
}

main().catch(console.error)
