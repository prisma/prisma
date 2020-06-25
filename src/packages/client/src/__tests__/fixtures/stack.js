class PrismaClient {
  get user() {
    return {
      findMany() {
        return new Error().stack
      },
    }
  }
}

exports.getStack = () => {
  const client = new PrismaClient()

  const templateString = `hello`
  const templateString2 = `${123}${256}`
  const result = client.user.findMany()

  return result
}
