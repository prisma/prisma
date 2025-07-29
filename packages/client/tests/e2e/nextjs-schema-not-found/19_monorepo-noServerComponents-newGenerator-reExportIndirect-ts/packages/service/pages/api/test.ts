import { db } from 'db'
import { NextApiRequest, NextApiResponse } from 'next'

async function doPrismaQuery() {
  await db.user.deleteMany()
  const user = await db.user.create({
    data: {
      email: 'test',
    },
  })

  return user
}

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  res.json({ user: await doPrismaQuery() })
}
