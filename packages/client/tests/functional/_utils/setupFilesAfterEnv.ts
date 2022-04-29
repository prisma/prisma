process.env.PRISMA_HIDE_PREVIEW_FLAG_WARNINGS = 'true'
process.env.DATABASE_URI_sqlite = 'file:dev.db'
process.env.DATABASE_URI_mongodb = process.env.TEST_MONGO_URI
process.env.DATABASE_URI_postgresql = process.env.TEST_POSTGRES_URI
process.env.DATABASE_URI_mysql = process.env.TEST_MYSQL_URI

export {}
