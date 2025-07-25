CREATE SCHEMA IF NOT EXISTS invoicing;

CREATE TYPE invoicing."InvoiceStatus" AS ENUM ('Paid', 'Unpaid');

CREATE TABLE invoicing."Invoice" (
    id INTEGER PRIMARY KEY,
    "orderId" INTEGER UNIQUE NOT NULL,
    amount DOUBLE PRECISION NOT NULL
);
