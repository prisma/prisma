const { PrismaClient } = require('db')

export async function generateStaticParams() {
  return [{ id: '1' }]
}

async function doPrismaQuery(params) {
  if (params.id === '1') return JSON.stringify({})

  const prisma = new PrismaClient()

  await prisma.user.deleteMany()
  const user = await prisma.user.create({
    data: {
      email: 'test'
    }
  })

  return JSON.stringify(user)
}

export default async function Page({ params }) {
  return (
    <div>
      {`${await doPrismaQuery(params)}`}
    </div>
  );
}
