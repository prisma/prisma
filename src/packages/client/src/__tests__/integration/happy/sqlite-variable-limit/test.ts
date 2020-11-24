// const pMap = require('p-map')
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')
import { getTestClient } from '../../../../utils/getTestClient'

jest.setTimeout(10000)

test('sqlite-variable-limit', async () => {
  const PrismaClient = await getTestClient()
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

  prisma.$disconnect()
})

// async function compressFile(filename) {
//   return new Promise((resolve, reject) => {
//     const compress = zlib.createBrotliCompress()
//     const input = fs.createReadStream(filename)
//     const output = fs.createWriteStream(filename + '.br')

//     input.pipe(compress).pipe(output)
//     output.on('finish', () => {
//       resolve()
//     })
//     output.on('error', (ex) => {
//       reject(ex)
//     })
//   })
// }

async function uncompressFile(filename) {
  return new Promise<void>((resolve, reject) => {
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
