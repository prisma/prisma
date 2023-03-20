CREATE TABLE cities (
  name       text,
  population real,
  elevation  int     -- (in ft)
);

CREATE TABLE capitals (
  state      char(2) UNIQUE NOT NULL
) INHERITS (cities);

CREATE TABLE definitely_not_cities (
  name       text,
  population real,
  elevation  int     -- (in ft)
);

CREATE TABLE definitely_not_capitals (
  state      char(2) UNIQUE NOT NULL
) INHERITS (definitely_not_cities);