exports['generate should work with a custom output dir 1'] = `

✔ Generated Prisma Client to ./generated/client in XXms

You can now start using Prisma Client in your code:

\`\`\`
import { PrismaClient } from './generated/client'
// or const { PrismaClient } = require('./generated/client')

const prisma = new PrismaClient()
\`\`\`

Explore the full API: http://pris.ly/d/client
`

exports['generate should work with a custom output dir 2'] = [
  {
    "id": 1,
    "email": "bob@bob.bob",
    "name": "Bobby Brown Sqlite"
  }
]
