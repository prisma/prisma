import { createMemoryTest } from '../_utils/createMemoryTest'

//@ts-ignore
type PrismaModule = typeof import('./.generated/node_modules/@prisma/client')

function generateRandomKey(length: number) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return result
}

function generateRandomObject(numKeys: number, keyLength: number) {
  const obj = {}
  const halfKeys = numKeys / 2

  for (let i = 0; i < halfKeys; i++) {
    const key = generateRandomKey(keyLength)
    obj[key] = generateRandomKey(10)
  }

  for (let i = halfKeys; i < numKeys; i++) {
    const key = generateRandomKey(keyLength)
    obj[key] = Math.floor(Math.random() * 1000)
  }

  return obj
}

void createMemoryTest({
  async prepare({ PrismaClient }: PrismaModule) {
    const client = new PrismaClient()
    await client.$connect()

    const data = {
      array1: Array(800)
        .fill(undefined)
        .map(() => generateRandomObject(120, 10)),
      array2: Array(300)
        .fill(undefined)
        .map(() => generateRandomObject(50, 10)),
      array3: Array(800)
        .fill(undefined)
        .map(() => generateRandomObject(40, 10)),
    }

    await client.test.upsert({
      where: { id: 1 },
      create: { data },
      update: { data },
    })

    return client
  },
  async run(client) {
    const id = 1

    const test = await client.test.findFirst({
      where: { id },
    })

    await client.test.update({
      where: { id },
      data: test,
    })
  },
  async cleanup(client) {
    await client.$disconnect()
  },
  iterations: 10,
})
