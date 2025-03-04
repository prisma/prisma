import fs from 'node:fs'
import path from 'node:path'

export function detectPrisma1() {
  if (fs.existsSync(path.join(process.cwd(), 'prisma.yml'))) {
    throw new Error(
      `We detected a Prisma 1 project. For Prisma 1, please use the \`prisma1\` CLI instead.
You can install it with \`npm install -g prisma1\`.
If you want to upgrade to Prisma 2+, please have a look at our upgrade guide:
http://pris.ly/d/upgrading-to-prisma2`,
    )
  }
}
