export default {
  earlyAccess: true,
  migrate: {
    adapter: async () => {
      return Promise.resolve({
        adapterName: '@prisma/adapter-mock-sqlite',
      })
    }
  }
}