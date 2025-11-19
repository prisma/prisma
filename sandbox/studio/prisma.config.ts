import { defineConfig } from '@prisma/config'
import { createConnection } from 'mysql2/promise'
 
const SQLITE_PATH = 'file:dev.db'

if (process.env.PROVIDER === 'mysql') {
  const connection = await createConnection(process.env.DATABASE_URL_MYSQL!)

  await connection.query(`DROP TABLE IF EXISTS User;`);
  await connection.query(`
    CREATE TABLE User (
      id INTEGER PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) NOT NULL
    );`);
  await connection.query(`
    INSERT INTO User (name, email) VALUES ('Alice', 'alice@example.com');
  `);
}

if (process.env.PROVIDER === 'sqlite') {
  let database: any

  const path = SQLITE_PATH.replace('file:', '')

  try {
    const { DatabaseSync } = await import('node:sqlite' as never)
  
    database = new DatabaseSync(path)
  } catch {
    const { Database } = await import('bun:sqlite' as never)
  
    database = new Database(path)
  }

  database.exec(
    `DROP TABLE IF EXISTS User;
    CREATE TABLE User (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE
    );
    insert into User (name, email) values ('Alice', 'alice@example.com');
    `
  )
  database.close()
}

export default defineConfig({
  datasource: {
    url: {
      mysql: process.env.DATABASE_URL_MYSQL!,
      postgres: process.env.DATABASE_URL_POSTGRES!,
      sqlite: SQLITE_PATH,
    }[process.env.PROVIDER!]!,
  },
})
