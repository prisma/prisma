-- Supabase reference roles fixture — captured via `pg_dumpall --roles-only`
-- from the same stack as `schema.sql` (see its header for version pins and
-- capture date). Restore this file BEFORE `schema.sql` — the schema's
-- policies and grants reference these roles.
--
-- Trims:
--   - `CREATE ROLE postgres` and its `ALTER ROLE postgres WITH ...`
--     (attributes) are dropped: `postgres` pre-exists as the PGlite dev
--     server's own connection role, and altering its own attributes is
--     refused ("permission denied to alter role").
--   - `PASSWORD '...'` clauses are stripped from every `ALTER ROLE` — local
--     Supabase CLI default SCRAM hashes, not secrets, no reason to check
--     them in.
--   - `GRANTED BY supabase_admin` is stripped from role-membership `GRANT`s
--     — the restoring connection isn't `supabase_admin` and has no ADMIN
--     OPTION on it ("permission denied to grant privileges as role").
--
-- PostgreSQL database cluster dump
--


SET default_transaction_read_only = off;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

--
-- Roles
--

CREATE ROLE anon;
ALTER ROLE anon WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE authenticated;
ALTER ROLE authenticated WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE authenticator;
ALTER ROLE authenticator WITH NOSUPERUSER NOINHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE dashboard_user;
ALTER ROLE dashboard_user WITH NOSUPERUSER INHERIT CREATEROLE CREATEDB NOLOGIN REPLICATION NOBYPASSRLS;
CREATE ROLE pgbouncer;
ALTER ROLE pgbouncer WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE service_role;
ALTER ROLE service_role WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION BYPASSRLS;
CREATE ROLE supabase_admin;
ALTER ROLE supabase_admin WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS;
CREATE ROLE supabase_auth_admin;
ALTER ROLE supabase_auth_admin WITH NOSUPERUSER NOINHERIT CREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE supabase_etl_admin;
ALTER ROLE supabase_etl_admin WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN REPLICATION BYPASSRLS;
CREATE ROLE supabase_functions_admin;
ALTER ROLE supabase_functions_admin WITH NOSUPERUSER NOINHERIT CREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE supabase_privileged_role;
ALTER ROLE supabase_privileged_role WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE supabase_read_only_user;
ALTER ROLE supabase_read_only_user WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION BYPASSRLS;
CREATE ROLE supabase_realtime_admin;
ALTER ROLE supabase_realtime_admin WITH NOSUPERUSER NOINHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE supabase_replication_admin;
ALTER ROLE supabase_replication_admin WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN REPLICATION NOBYPASSRLS;
CREATE ROLE supabase_storage_admin;
ALTER ROLE supabase_storage_admin WITH NOSUPERUSER NOINHERIT CREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS;

--
-- User Configurations
--

--
-- User Config "anon"
--

ALTER ROLE anon SET statement_timeout TO '3s';

--
-- User Config "authenticated"
--

ALTER ROLE authenticated SET statement_timeout TO '8s';

--
-- User Config "authenticator"
--

ALTER ROLE authenticator SET session_preload_libraries TO 'safeupdate';
ALTER ROLE authenticator SET statement_timeout TO '8s';
ALTER ROLE authenticator SET lock_timeout TO '8s';

--
-- User Config "postgres"
--

ALTER ROLE postgres SET search_path TO E'\\$user', 'public', 'extensions';

--
-- User Config "supabase_admin"
--

ALTER ROLE supabase_admin SET search_path TO E'\\$user', 'public', 'auth', 'extensions';
ALTER ROLE supabase_admin SET log_statement TO 'none';

--
-- User Config "supabase_auth_admin"
--

ALTER ROLE supabase_auth_admin SET search_path TO 'auth';
ALTER ROLE supabase_auth_admin SET idle_in_transaction_session_timeout TO '60000';
ALTER ROLE supabase_auth_admin SET log_statement TO 'none';

--
-- User Config "supabase_functions_admin"
--

ALTER ROLE supabase_functions_admin SET search_path TO 'supabase_functions';

--
-- User Config "supabase_read_only_user"
--

ALTER ROLE supabase_read_only_user SET default_transaction_read_only TO 'on';

--
-- User Config "supabase_storage_admin"
--

ALTER ROLE supabase_storage_admin SET search_path TO 'storage';
ALTER ROLE supabase_storage_admin SET log_statement TO 'none';


--
-- Role memberships
--

GRANT anon TO authenticator WITH INHERIT FALSE;
GRANT anon TO postgres WITH ADMIN OPTION, INHERIT TRUE;
GRANT authenticated TO authenticator WITH INHERIT FALSE;
GRANT authenticated TO postgres WITH ADMIN OPTION, INHERIT TRUE;
GRANT authenticator TO postgres WITH ADMIN OPTION, INHERIT TRUE;
GRANT authenticator TO supabase_storage_admin WITH INHERIT FALSE;
GRANT pg_create_subscription TO postgres WITH ADMIN OPTION, INHERIT TRUE;
GRANT pg_monitor TO postgres WITH ADMIN OPTION, INHERIT TRUE;
GRANT pg_monitor TO supabase_etl_admin WITH INHERIT TRUE;
GRANT pg_monitor TO supabase_read_only_user WITH INHERIT TRUE;
GRANT pg_read_all_data TO postgres WITH ADMIN OPTION, INHERIT TRUE;
GRANT pg_read_all_data TO supabase_etl_admin WITH INHERIT TRUE;
GRANT pg_read_all_data TO supabase_read_only_user WITH INHERIT TRUE;
GRANT pg_signal_backend TO postgres WITH ADMIN OPTION, INHERIT TRUE;
GRANT service_role TO authenticator WITH INHERIT FALSE;
GRANT service_role TO postgres WITH ADMIN OPTION, INHERIT TRUE;
GRANT supabase_functions_admin TO postgres WITH INHERIT TRUE;
GRANT supabase_privileged_role TO postgres WITH INHERIT TRUE;
GRANT supabase_privileged_role TO supabase_etl_admin WITH INHERIT TRUE;
GRANT supabase_realtime_admin TO postgres WITH INHERIT TRUE;





--
-- PostgreSQL database cluster dump complete
--

