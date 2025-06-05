export default {
  earlyAccess: true,
  migrate: {
    // @ts-ignore
    adapter: async () => {
      return Promise.resolve({
        adapterName: '@prisma/adapter-sqlite-mock',
      })
    },
  },
}
