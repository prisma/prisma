export default {
  experimental: {
    adapter: true,
  },
  // @ts-ignore
  adapter: async () => {
    return Promise.resolve({
      adapterName: '@prisma/adapter-sqlite-mock',
    })
  },
}
