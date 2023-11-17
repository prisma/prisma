CREATE TABLE public.SomeUser (
    id BIGINT PRIMARY KEY,
    first_name VARCHAR(30) NOT NULL,
    last_name VARCHAR(30) NULL,
    company_id BIGINT
);

CREATE SCHEMA IF NOT EXISTS work;

CREATE TABLE work.Company (
    id BIGINT PRIMARY KEY,
    name VARCHAR(30) NOT NULL
);
