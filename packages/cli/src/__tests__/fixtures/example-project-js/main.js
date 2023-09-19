const { PrismaClient } = require('./generated/client')

exports.main = async function main() {
  const client = new PrismaClient()

  const data = await client.user.findMany()
  client.$disconnect()
  return data
}
