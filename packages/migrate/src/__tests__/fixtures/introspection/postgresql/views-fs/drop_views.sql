-- remove any view in the database

DO
$do$
BEGIN

EXECUTE (
  SELECT 'DROP VIEW ' || string_agg(table_schema || '.' || table_name, ', ') || ' cascade;'
  FROM information_schema.views
  WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
  AND table_name !~ '^pg_'
);

END
$do$;