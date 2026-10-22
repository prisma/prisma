import { blindCast } from '@internal/utils/casts';
import { ifDefined } from '@internal/utils/defined';
import type { ConnectionOptions } from 'mysql2/promise';

const MULTI_STATEMENTS_FLAG = 'MULTI_STATEMENTS';

function parameterValue(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function flagsWithoutMultipleStatements(flags: unknown): string[] | undefined {
  if (flags === undefined) return undefined;
  const listed = Array.isArray(flags) ? flags.map(String) : String(flags).split(/\s*,+\s*/);
  return listed
    .map((flag) => flag.toUpperCase())
    .filter((flag) => flag.length > 0 && flag !== MULTI_STATEMENTS_FLAG);
}

/**
 * The mysql2 options for a connection URL, read as mysql2 reads one, with multiple statements kept off and object parameters sent as text, whatever the URL's parameters say.
 */
export function mysqlConnectionOptions(url: string, connectTimeoutMs?: number): ConnectionOptions {
  const parsed = new URL(url);
  const { flags, ...parameters } = Object.fromEntries(
    [...parsed.searchParams].map(([key, value]) => [key, parameterValue(value)]),
  );
  return {
    ...blindCast<
      ConnectionOptions,
      'mysql2 reads each URL parameter as the option of the same name, JSON-parsed when it parses'
    >(parameters),
    host: decodeURIComponent(parsed.hostname),
    ...ifDefined('port', parsed.port === '' ? undefined : Number(parsed.port)),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.slice(1)),
    ...ifDefined('flags', flagsWithoutMultipleStatements(flags)),
    multipleStatements: false,
    stringifyObjects: true,
    timezone: 'Z',
    ...ifDefined('connectTimeout', connectTimeoutMs),
  };
}
