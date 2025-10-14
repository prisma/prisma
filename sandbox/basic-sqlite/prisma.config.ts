export default {
  earlyAccess: true,
  schema: './prisma/schema.prisma',
  migrate: {
    driver: async () => {
      return Promise.resolve({
        driverName: '@prisma/driver-mock-sqlite',
      })
    }
  }
}
