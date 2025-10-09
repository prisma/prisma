export default {
  experimental: {
    adapter: true,
  },
  engine: 'js',
  // @ts-ignore
  adapter: async () => {
    return Promise.resolve({
      adapterName: '@prisma/adapter-sqlite-mock',
    })
  },
}
