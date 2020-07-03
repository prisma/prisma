const { PrismaClient } = require('@prisma/client')
const pMap = require('p-map')
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

module.exports = async () => {
  const prisma = new PrismaClient()
  const db = path.join(__dirname, 'dev.db')
  if (!fs.existsSync(db)) {
    await uncompressFile(db)
  }

  const result = await prisma.user.findMany({
    include: {
      posts: true,
    },
  })

  prisma.disconnect()
}

if (require.main === module) {
  module.exports()
  // seed()
  // compress()
}

async function seed() {
  const prisma = new PrismaClient()
  const arr = new Array(100000).fill()
  await pMap(
    arr,
    async (_, i) => {
      await prisma.user.create({
        data: {
          email: `a+${i}@hey.com`,
          name: `Bob`,
          posts: {
            create: new Array(1).fill(undefined).map((_, i) => ({
              published: true,
              title: '',
            })),
          },
        },
      })

      if (i % 1000 === 0) {
        console.log(`Done with ${i}`)
      }
    },
    { concurrency: 20 },
  )
  prisma.disconnect()
}

async function compressFile(filename) {
  return new Promise((resolve, reject) => {
    const compress = zlib.createBrotliCompress()
    const input = fs.createReadStream(filename)
    const output = fs.createWriteStream(filename + '.br')

    input.pipe(compress).pipe(output)
    output.on('finish', () => {
      resolve()
    })
    output.on('error', (ex) => {
      reject(ex)
    })
  })
}

async function uncompressFile(filename) {
  return new Promise((resolve, reject) => {
    const decompress = zlib.createBrotliDecompress()
    const input = fs.createReadStream(filename + '.br')
    const output = fs.createWriteStream(filename)

    input.pipe(decompress).pipe(output)
    output.on('finish', () => {
      resolve()
    })
    output.on('error', (ex) => {
      reject(ex)
    })
  })
}
