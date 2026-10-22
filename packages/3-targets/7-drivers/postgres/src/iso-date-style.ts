import type { ClientConfig } from 'pg';
import { parseIntoClientConfig } from 'pg-connection-string';

const ISO_DATE_STYLE_OPTION = '-c DateStyle=ISO';

/** The settings pg's `ConnectionParameters` reads from a parsed connection string. Any other query parameter is not a connection setting, and pg ignores it in a connection string. */
const CONNECTION_SETTINGS = [
  'user',
  'password',
  'host',
  'port',
  'database',
  'binary',
  'options',
  'ssl',
  'sslnegotiation',
  'client_encoding',
  'replication',
  'application_name',
  'fallback_application_name',
  'statement_timeout',
  'lock_timeout',
  'idle_in_transaction_session_timeout',
  'query_timeout',
] as const;

/**
 * The settings of a connection Prisma opens from `url`: the connection settings the URL gives, with `DateStyle=ISO` added as a startup option after the options the URL gives, or else after `PGOPTIONS`, which is where pg reads them from. A startup option sets the session's default, so `RESET ALL` keeps it, and the date and time codecs read only ISO text.
 */
export function isoDateStyleConnectionConfig(url: string): ClientConfig {
  const parsed = parseIntoClientConfig(url);
  const config: ClientConfig = {};
  for (const setting of CONNECTION_SETTINGS) {
    const value: unknown = Reflect.get(parsed, setting);
    if (value !== undefined) Object.assign(config, { [setting]: value });
  }
  const given = parsed.options || process.env['PGOPTIONS'];
  config.options = given ? `${given} ${ISO_DATE_STYLE_OPTION}` : ISO_DATE_STYLE_OPTION;
  return config;
}
