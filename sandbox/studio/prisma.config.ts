import { defineConfig } from '@prisma/config'
// @ts-ignore
import { DatabaseSync } from 'node:sqlite'
 
const SQLITE_PATH = 'file:dev.db'

export default defineConfig({
  datasource: {
    url: {
      mysql: process.env.DATABASE_URL_MYSQL!,
      postgres: process.env.DATABASE_URL_POSTGRES!,
      sqlite: SQLITE_PATH,
    }[process.env.PROVIDER!]!,
  },
})

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
