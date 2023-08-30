const { db } = require('db')

async function doPrismaQuery() {
  await db.user.deleteMany()
  const user = await db.user.create({
    data: {
      email: 'test',
    },
  })

  return user
}

export default async function handle(req, res) {
  res.json({ user: await doPrismaQuery() })
}
