import { getTestClient } from '../../../../utils/getTestClient'
import sql from 'sql-template-tag'

let prisma

beforeAll(async () => {
  const PrismaClient = await getTestClient()
  prisma = new PrismaClient()
})

afterAll(() => {
  prisma.$disconnect()
})

test('executeRaw-alter-postgres', async () => {
  const password = 'prisma'
  // throw
  try {
    await prisma.$executeRaw`ALTER USER prisma WITH PASSWORD '${password}'`
  } catch (err) {
    //isReadonlyArray
    expect(err).toMatchInlineSnapshot(`
      Running ALTER with parameters is not supported
      Please modify following to use it but note that this is vulnerable to SQL injection attacks:
        await prisma.$executeRaw(\`ALTER USER prisma WITH PASSWORD '\${password}'\`)

    `)
  }
  try {
    await prisma.$executeRaw(`ALTER USER prisma WITH PASSWORD $1`, password)
  } catch (err) {
    // String
    expect(err).toMatchInlineSnapshot(`
      Running ALTER with parameters is not supported
      Please modify following to use it but note that this is vulnerable to SQL injection attacks:
        await prisma.$executeRaw(\`ALTER USER prisma WITH PASSWORD '\${password}'\`)

    `)
  }
  try {
    await prisma.$executeRaw(sql`ALTER USER prisma WITH PASSWORD '${password}'`)
  } catch (err) {
    // Else
    expect(err).toMatchInlineSnapshot(`
      Running ALTER with parameters is not supported
      Please modify following to use it but note that this is vulnerable to SQL injection attacks:
        await prisma.$executeRaw(\`ALTER USER prisma WITH PASSWORD '\${password}'\`)

    `)
  }

  // Works, maybe add a warning that this is unsafe?
  const result = await prisma.$executeRaw(
    `ALTER USER prisma WITH PASSWORD '${password}'`,
  )
  expect(result).toMatchInlineSnapshot(`0`)
})
