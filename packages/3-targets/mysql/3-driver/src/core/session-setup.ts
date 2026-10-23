/**
 * The statements every new connection runs before any other. The renderer writes literal text with backslashes doubled, and the lexer that finds placeholders reads a backslash as an escape and `"…"` as a string, so the session clears NO_BACKSLASH_ESCAPES and ANSI_QUOTES and MySQL reads quoted text the same way. The session runs in UTC, so `CURRENT_TIMESTAMP` writes the UTC time the codecs read.
 */
export const SESSION_SETUP = [
  "SET SESSION sql_mode = TRIM(BOTH ',' FROM REPLACE(REPLACE(CONCAT(',', @@SESSION.sql_mode, ','), ',NO_BACKSLASH_ESCAPES,', ','), ',ANSI_QUOTES,', ','))",
  "SET SESSION time_zone = '+00:00'",
] as const;
