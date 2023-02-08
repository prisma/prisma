import express from 'express'

import { PrismaClient } from '.prisma/client'

let client: PrismaClient | undefined

const port = 3000
const app = express()
app.get('/', async (req, res) => {
  const data = await client?.user.findMany()
  res.send(JSON.stringify(data))
})

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`)
})

// eslint-disable-next-line @typescript-eslint/require-await
async function main() {
  // only start the engines
  client = new PrismaClient()

  // connect to the database
  // await client.$connect()
}

main().catch((e) => {
  console.log(e)
  process.exit(1)
})
