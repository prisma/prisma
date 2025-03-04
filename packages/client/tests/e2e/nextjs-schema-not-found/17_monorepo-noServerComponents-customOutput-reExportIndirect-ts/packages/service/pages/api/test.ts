import { db } from 'db'

async function doPrismaQuery() {
  await db.user.deleteMany()
  const user = await db.user.create({
    data: {
      email: 'test',
    },
  })

  return user
}

export default async function handle(_req, res) {
  res.json({ user: await doPrismaQuery() })
}
