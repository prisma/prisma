const { PrismaClient } = require('@prisma/client')

module.exports = async () => {
  const prisma = new PrismaClient()
  try {
    const post = await prisma.post.findMany({
      include: {
        author: true,
      },
    })
    console.log(post)
  } catch (e) {
    prisma.disconnect()
    throw e
  }
}

if (require.main === module) {
  module.exports()
}
