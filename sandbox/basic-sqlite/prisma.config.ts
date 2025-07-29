export default {
  earlyAccess: true,
  schema: './prisma/schema.prisma',
  migrate: {
    adapter: async () => {
      return Promise.resolve({
        adapterName: '@prisma/adapter-mock-sqlite',
      })
    }
  }
}
