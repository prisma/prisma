export default {
  earlyAccess: true,
  // @ts-ignore
  adapter: async () => {
    return Promise.resolve({
      adapterName: '@prisma/adapter-sqlite-mock',
    })
  },
}
