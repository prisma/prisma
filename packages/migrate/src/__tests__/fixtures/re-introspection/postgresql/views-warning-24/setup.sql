CREATE TABLE "User" (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NULL
);

CREATE VIEW "Schwuser" AS
  SELECT id, first_name, last_name FROM "User";