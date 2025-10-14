export default {
  experimental: {
    driver: true,
  },
  // @ts-ignore
  driver: async () => {
    return Promise.resolve({
      driverName: '@prisma/driver-sqlite-mock',
    })
  },
}
