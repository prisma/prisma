-- `prisma migrate reset --force` creates this table, but we want to simulate a fresh database
DROP TABLE IF EXISTS _prisma_migrations;

CREATE SCHEMA IF NOT EXISTS invoicing;

CREATE TYPE invoicing."InvoiceStatus" AS ENUM ('Paid', 'Unpaid');

CREATE TABLE invoicing."Invoice" (
    id INTEGER PRIMARY KEY,
    "orderId" INTEGER UNIQUE NOT NULL,
    amount DOUBLE PRECISION NOT NULL
);
