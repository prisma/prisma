import { defineConfig } from '@prisma/config'
// @ts-ignore
import { DatabaseSync } from 'node:sqlite'
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
  const database = new DatabaseSync(SQLITE_PATH.replace('file:', ''))
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
