/**
 * The statements every new connection runs before any other, and again before a connection whose session a statement changed serves its next borrower. The renderer writes literal text with backslashes doubled, and the lexer that finds placeholders reads a backslash as an escape and `"…"` as a string, so the session clears NO_BACKSLASH_ESCAPES and ANSI_QUOTES and MySQL reads quoted text the same way. The session runs in UTC, so `CURRENT_TIMESTAMP` writes the UTC time the codecs read, and in utf8mb4. The session reports a change to any of these settings in the statement's result (`SESSION_TRACKED_VARIABLES`), which is how the runtime driver knows to run the setup again.
 */
/** The session settings the setup writes, which MySQL then reports a change to in the result of the statement that made it; the tracking setting itself is among them, so turning tracking off is reported too. */
export const SESSION_TRACKED_VARIABLES = [
  'sql_mode',
  'time_zone',
  'character_set_client',
  'character_set_connection',
  'character_set_results',
  'collation_connection',
  'session_track_system_variables',
] as const;

export const SESSION_SETUP = [
  "SET SESSION sql_mode = TRIM(BOTH ',' FROM REPLACE(REPLACE(CONCAT(',', @@SESSION.sql_mode, ','), ',NO_BACKSLASH_ESCAPES,', ','), ',ANSI_QUOTES,', ','))",
  "SET SESSION time_zone = '+00:00'",
  'SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci',
  `SET SESSION session_track_system_variables = '${SESSION_TRACKED_VARIABLES.join(',')}'`,
] as const;
