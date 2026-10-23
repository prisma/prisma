import { blindCast } from '@internal/utils/casts';
import { ifDefined } from '@internal/utils/defined';
import { structuredError } from '@internal/utils/structured-error';
import type { ConnectionOptions } from 'mysql2/promise';

const MULTI_STATEMENTS_FLAG = 'MULTI_STATEMENTS';

/** The URL parameters mysql2 reads as connection options. Any other mysql2 option could change how a statement is sent, such as `namedPlaceholders`, so none other is passed on. */
const CONNECTION_PARAMETERS = new Set(['ssl', 'charset', 'connectTimeout', 'flags']);

/** The URL parameters the runtime driver's pool reads. */
const POOL_PARAMETERS = new Set(['connectionLimit', 'poolTimeout']);

const DEFAULT_POOL_TIMEOUT_MS = 10_000;

function parameterValue(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function invalidBinding(reason: string, received: string): Error {
  return structuredError('RUNTIME.BINDING_INVALID', `MySQL connection URL: ${reason}`, {
    meta: { received, reason },
  });
}

function urlParameters(parsed: URL): Map<string, string> {
  const parameters = new Map(parsed.searchParams);
  for (const name of parameters.keys()) {
    if (!CONNECTION_PARAMETERS.has(name) && !POOL_PARAMETERS.has(name)) {
      throw invalidBinding(
        `the parameter ${name} is not one the MySQL driver reads; it reads ${[...CONNECTION_PARAMETERS, ...POOL_PARAMETERS].join(', ')}`,
        name,
      );
    }
  }
  return parameters;
}

function flagsWithoutMultipleStatements(flags: unknown): string[] | undefined {
  if (flags === undefined) return undefined;
  const listed = Array.isArray(flags) ? flags.map(String) : String(flags).split(/\s*,+\s*/);
  return listed
    .map((flag) => flag.toUpperCase())
    .filter((flag) => flag.length > 0 && flag !== MULTI_STATEMENTS_FLAG);
}

/**
 * The mysql2 options for a connection URL, with multiple statements kept off whatever the flags say. Refuses a URL parameter the driver does not read.
 */
export function mysqlConnectionOptions(url: string, connectTimeoutMs?: number): ConnectionOptions {
  const parsed = new URL(url);
  const parameters = urlParameters(parsed);
  const { flags, ...options } = Object.fromEntries(
    [...parameters]
      .filter(([name]) => CONNECTION_PARAMETERS.has(name))
      .map(([name, value]) => [name, parameterValue(value)]),
  );
  return {
    ...blindCast<
      ConnectionOptions,
      'each allowed URL parameter is the mysql2 option of the same name, JSON-parsed when it parses'
    >(options),
    host: decodeURIComponent(parsed.hostname),
    ...ifDefined('port', parsed.port === '' ? undefined : Number(parsed.port)),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.slice(1)),
    ...ifDefined('flags', flagsWithoutMultipleStatements(flags)),
    multipleStatements: false,
    timezone: 'Z',
    ...ifDefined('connectTimeout', connectTimeoutMs),
  };
}

export interface MysqlPoolSettings {
  readonly connectionLimit: number | undefined;
  /** How long a statement waits for a free pooled connection before it fails. */
  readonly poolTimeoutMs: number;
}

function positiveInteger(name: string, text: string | undefined): number | undefined {
  if (text === undefined) return undefined;
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw invalidBinding(`${name} must be a positive integer`, `${name}=${text}`);
  }
  return value;
}

/** The pool settings a connection URL gives: `connectionLimit`, and `poolTimeout` in milliseconds, ten seconds unless the URL says otherwise. */
export function mysqlPoolSettings(url: string): MysqlPoolSettings {
  const parameters = urlParameters(new URL(url));
  return {
    connectionLimit: positiveInteger('connectionLimit', parameters.get('connectionLimit')),
    poolTimeoutMs:
      positiveInteger('poolTimeout', parameters.get('poolTimeout')) ?? DEFAULT_POOL_TIMEOUT_MS,
  };
}
