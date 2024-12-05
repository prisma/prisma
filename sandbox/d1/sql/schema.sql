DROP TABLE IF EXISTS Customers;

CREATE TABLE IF NOT EXISTS Customers (
    CustomerId INTEGER PRIMARY KEY,
    CompanyName TEXT,
    ContactName TEXT
);

INSERT INTO
    Customers (CustomerID, CompanyName, ContactName)
VALUES
    (1, 'Alfreds Futterkiste', 'Maria Anders'),
    (4, 'Around the Horn', 'Thomas Hardy'),
    (11, 'Bs Beverages', 'Victoria Ashworth'),
    (13, 'Bs Beverages', 'Random Name'),
    (42, 'The Answer', NULL);

DROP TABLE IF EXISTS Test;

CREATE TABLE IF NOT EXISTS Test (
    id INTEGER PRIMARY KEY,
    text TEXT,
    real REAL,
    int INTEGER,
    boolean BOOLEAN,
    blob BLOB
);

DROP TABLE IF EXISTS PrismaTest;

CREATE TABLE IF NOT EXISTS PrismaTest (
    id INTEGER PRIMARY KEY,
    date TEXT,
    bigint INTEGER,
    decimal TEXT
);

DROP TABLE IF EXISTS "Post";

DROP TABLE IF EXISTS "User";

CREATE TABLE "User" (id INTEGER PRIMARY KEY);

CREATE TABLE "Post" (
    id INTEGER PRIMARY KEY,
    "authorId" INTEGER NOT NULL,
    title TEXT NOT NULL,
    FOREIGN KEY ("authorId") REFERENCES "User"(id)
);