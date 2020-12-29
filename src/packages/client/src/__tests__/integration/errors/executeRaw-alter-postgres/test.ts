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
  // Should Throw
  try {
    await prisma.$executeRaw`ALTER USER prisma WITH PASSWORD '${password}'`
  } catch (err) {
    //isReadonlyArray
    expect(err).toMatchInlineSnapshot(`
      Running ALTER using prisma.$executeRaw\`<SQL>\` is not supported
      Please use the following example but note that this could be vulnerable to SQL injection attacks

      Example:
        await prisma.$executeRaw(\`ALTER USER prisma WITH PASSWORD '\${password}'\`)

      More Information: https://pris.ly/d/execute-raw

    `)
  }
  try {
    await prisma.$executeRaw(`ALTER USER prisma WITH PASSWORD $1`, password)
  } catch (err) {
    // String
    expect(err).toMatchInlineSnapshot(`
      Running ALTER using prisma.$executeRaw(<SQL>, [...values]) is not supported
      Please use the following example but note that this could be vulnerable to SQL injection attacks

      Example:
        await prisma.$executeRaw(\`ALTER USER prisma WITH PASSWORD '\${password}'\`)

      More Information: https://pris.ly/d/execute-raw

    `)
  }
  try {
    await prisma.$executeRaw(sql`ALTER USER prisma WITH PASSWORD '${password}'`)
  } catch (err) {
    // Else
    expect(err).toMatchInlineSnapshot(`
      Running ALTER using prisma.$executeRaw(sql\`<SQL>\`) is not supported
      Please use the following example but note that this could be vulnerable to SQL injection attacks

      Example:
        await prisma.$executeRaw(\`ALTER USER prisma WITH PASSWORD '\${password}'\`)

      More Information: https://pris.ly/d/execute-raw

    `)
  }

  // Should Work
  const result = await prisma.$executeRaw(
    `ALTER USER prisma WITH PASSWORD '${password}'`,
  )
  expect(result).toMatchInlineSnapshot(`0`)
})
