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

CREATE VIEW public.SimpleUser AS (
    SELECT
        su.first_name,
        su.last_name
    FROM public.SomeUser su
);

CREATE VIEW work.Workers AS (
    SELECT
        su.first_name,
        su.last_name,
        c.name AS company_name
    FROM public.SomeUser su
    LEFT JOIN work.Company c ON su.company_id = c.id
);
