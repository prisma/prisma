process.env.PRISMA_HIDE_PREVIEW_FLAG_WARNINGS = 'true'
process.env.DATABASE_URI_sqlite = 'file:dev.db'
process.env.DATABASE_URI_mongodb = process.env.TEST_MONGO_URI

export {}
