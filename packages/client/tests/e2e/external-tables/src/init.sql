-- `prisma migrate reset --force` creates this table, but we want to simulate a fresh database
DROP TABLE IF EXISTS _prisma_migrations;

-- Enum used by users table
CREATE TYPE role AS ENUM ('customer', 'support', 'admin');

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  role role
);