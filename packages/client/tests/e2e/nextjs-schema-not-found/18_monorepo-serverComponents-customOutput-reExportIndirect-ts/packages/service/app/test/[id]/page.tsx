import { db } from 'db'

// eslint-disable-next-line @typescript-eslint/require-await
export async function generateStaticParams() {
  return [{ id: '1' }]
}

async function doPrismaQuery(params) {
  if (params.id === '1') return JSON.stringify({})

  await db.user.deleteMany()
  const user = await db.user.create({
    data: {
      email: 'test',
    },
  })

  return JSON.stringify(user)
}

export default async function Page({ params }) {
  return <div>{await doPrismaQuery(params)}</div>
}
