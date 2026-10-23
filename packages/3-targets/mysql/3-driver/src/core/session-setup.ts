/**
 * The statements every new connection runs before any other. mysql2 escapes a quote in a parameter with a backslash, which MySQL reads as text under NO_BACKSLASH_ESCAPES, so the session clears that mode. The session runs in UTC, so `CURRENT_TIMESTAMP` writes the UTC time the codecs read.
 */
export const SESSION_SETUP = [
  "SET SESSION sql_mode = TRIM(BOTH ',' FROM REPLACE(CONCAT(',', @@SESSION.sql_mode, ','), ',NO_BACKSLASH_ESCAPES,', ','))",
  "SET SESSION time_zone = '+00:00'",
] as const;
