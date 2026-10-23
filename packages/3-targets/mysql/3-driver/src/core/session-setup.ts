/**
 * The statements every new connection runs before any other. mysql2 escapes a quote in a parameter with a backslash, which MySQL reads as text under NO_BACKSLASH_ESCAPES, so the session clears that mode. The session runs in UTC, so `CURRENT_TIMESTAMP` writes the UTC time the codecs read. `group_concat_max_len` is raised to the largest result a connection can send, because an include builds its JSON array with `GROUP_CONCAT`: a longer array would be cut short and then fail its cast to JSON.
 */
export const SESSION_SETUP = [
  "SET SESSION sql_mode = TRIM(BOTH ',' FROM REPLACE(CONCAT(',', @@SESSION.sql_mode, ','), ',NO_BACKSLASH_ESCAPES,', ','))",
  "SET SESSION time_zone = '+00:00'",
  'SET SESSION group_concat_max_len = @@SESSION.max_allowed_packet',
] as const;
