import { generateTestClient } from '../../../../utils/getTestClient'

test('blog-dot-env-both-conflict', async () => {
  await generateTestClient()

  const { PrismaClient } = require('./node_modules/@prisma/client')
  try {
    const prisma = new PrismaClient({
      errorFormat: 'colorless',
    })
  } catch (e) {
    expect(e).toMatchInlineSnapshot(`

            You are trying to load env variables which are already present in your project root .env
            	Root: /client/src/__tests__/integration/happy/blog-dot-env-both-conflict/.env
            	Prisma: /client/src/__tests__/integration/happy/blog-dot-env-both-conflict/prisma/.env
            	Env Conflicts:
            		SQLITE_URL_FROM_DOT_ENV_FILE

            You can fix this by removing the .env file from "/client/src/__tests__/integration/happy/blog-dot-env-both-conflict/prisma/.env" and move its contents to your .env file at the root "/client/src/__tests__/integration/happy/blog-dot-env-both-conflict/.env"
            
    `)
  }
})
