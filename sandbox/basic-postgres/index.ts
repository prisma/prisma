import { PrismaClient } from '.prisma/client'

async function main() {
  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
    ],
  })

  prisma.$on('query', ({ query, params }) => {
    console.log('[query]')
    console.dir({ query, params }, { depth: null })
    console.log('')
  })

  await prisma
    .$transaction((tx) => {
      console.log('1')
      console.log(tx)
      console.log('2')

      return Promise.resolve()
    })
    .then(() => console.log('finished'))

  process.exit(0)
}

void main().catch((e) => {
  console.log(e)
  process.exit(1)
})
