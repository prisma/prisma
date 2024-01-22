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