import { describe, expect, it } from 'vitest';
import {
  pgDate,
  pgDateCanonical,
  pgTime,
  pgTimeCanonical,
  pgTimestamp,
  pgTimestampCanonical,
  pgTimestamptz,
  pgTimestamptzCanonical,
  pgTimetz,
  pgTimetzCanonical,
} from '../src/core/data-types';
import { prisma7TemporalTagBody } from '../src/core/prisma7-temporal-defaults';

/**
 * Each row is a `@default("...")` Prisma 7 accepts for a `DateTime` field, and
 * the text inside the column default Postgres reports for each native type
 * after applying the SQL `prisma@7.10.0 migrate diff` generated, read with
 * `pg_get_expr` in a UTC session. Precision modifiers do not change the stored
 * default.
 */
const storedByPostgres: readonly (readonly [
  string,
  Readonly<Record<'timestamp' | 'timestamptz' | 'date' | 'time' | 'timetz', string>>,
])[] = [
  [
    '2024-01-02T03:04:05.000Z',
    {
      timestamp: '2024-01-02 03:04:05',
      timestamptz: '2024-01-02 03:04:05+00',
      date: '2024-01-02',
      time: '03:04:05',
      timetz: '03:04:05+00',
    },
  ],
  [
    '2024-01-02T03:04:05.123Z',
    {
      timestamp: '2024-01-02 03:04:05.123',
      timestamptz: '2024-01-02 03:04:05.123+00',
      date: '2024-01-02',
      time: '03:04:05.123',
      timetz: '03:04:05.123+00',
    },
  ],
  [
    '2024-01-02T03:04:05.1235Z',
    {
      timestamp: '2024-01-02 03:04:05.1235',
      timestamptz: '2024-01-02 03:04:05.1235+00',
      date: '2024-01-02',
      time: '03:04:05.1235',
      timetz: '03:04:05.1235+00',
    },
  ],
  [
    '2024-01-02T03:04:05.1234995Z',
    {
      timestamp: '2024-01-02 03:04:05.1235',
      timestamptz: '2024-01-02 03:04:05.1235+00',
      date: '2024-01-02',
      time: '03:04:05.1235',
      timetz: '03:04:05.1235+00',
    },
  ],
  [
    '2024-01-02T03:04:05+02:00',
    {
      timestamp: '2024-01-02 03:04:05',
      timestamptz: '2024-01-02 01:04:05+00',
      date: '2024-01-02',
      time: '03:04:05',
      timetz: '03:04:05+02',
    },
  ],
  [
    '2024-01-02T23:04:05-05:00',
    {
      timestamp: '2024-01-02 23:04:05',
      timestamptz: '2024-01-03 04:04:05+00',
      date: '2024-01-02',
      time: '23:04:05',
      timetz: '23:04:05-05',
    },
  ],
  [
    '2024-01-02T03:04:05+05:30',
    {
      timestamp: '2024-01-02 03:04:05',
      timestamptz: '2024-01-01 21:34:05+00',
      date: '2024-01-02',
      time: '03:04:05',
      timetz: '03:04:05+05:30',
    },
  ],
  [
    '2024-01-02T03:04:05-00:00',
    {
      timestamp: '2024-01-02 03:04:05',
      timestamptz: '2024-01-02 03:04:05+00',
      date: '2024-01-02',
      time: '03:04:05',
      timetz: '03:04:05+00',
    },
  ],
  [
    '2024-01-02t03:04:05z',
    {
      timestamp: '2024-01-02 03:04:05',
      timestamptz: '2024-01-02 03:04:05+00',
      date: '2024-01-02',
      time: '03:04:05',
      timetz: '03:04:05+00',
    },
  ],
  [
    '2024-01-02 03:04:05Z',
    {
      timestamp: '2024-01-02 03:04:05',
      timestamptz: '2024-01-02 03:04:05+00',
      date: '2024-01-02',
      time: '03:04:05',
      timetz: '03:04:05+00',
    },
  ],
  [
    '2024-01-02T03:04:05.1234567891Z',
    {
      timestamp: '2024-01-02 03:04:05.123457',
      timestamptz: '2024-01-02 03:04:05.123457+00',
      date: '2024-01-02',
      time: '03:04:05.123457',
      timetz: '03:04:05.123457+00',
    },
  ],
  [
    '2024-01-02T03:04:05.1234565Z',
    {
      timestamp: '2024-01-02 03:04:05.123456',
      timestamptz: '2024-01-02 03:04:05.123456+00',
      date: '2024-01-02',
      time: '03:04:05.123456',
      timetz: '03:04:05.123456+00',
    },
  ],
  [
    '2024-01-02T03:04:05.1234575Z',
    {
      timestamp: '2024-01-02 03:04:05.123458',
      timestamptz: '2024-01-02 03:04:05.123458+00',
      date: '2024-01-02',
      time: '03:04:05.123458',
      timetz: '03:04:05.123458+00',
    },
  ],
  [
    '2024-01-02T03:04:05.1234565001Z',
    {
      timestamp: '2024-01-02 03:04:05.123457',
      timestamptz: '2024-01-02 03:04:05.123457+00',
      date: '2024-01-02',
      time: '03:04:05.123457',
      timetz: '03:04:05.123457+00',
    },
  ],
  [
    '2024-01-02T03:04:05.12345650000001Z',
    {
      timestamp: '2024-01-02 03:04:05.123457',
      timestamptz: '2024-01-02 03:04:05.123457+00',
      date: '2024-01-02',
      time: '03:04:05.123457',
      timetz: '03:04:05.123457+00',
    },
  ],
  [
    '2024-01-02T03:04:05.1234564999Z',
    {
      timestamp: '2024-01-02 03:04:05.123456',
      timestamptz: '2024-01-02 03:04:05.123456+00',
      date: '2024-01-02',
      time: '03:04:05.123456',
      timetz: '03:04:05.123456+00',
    },
  ],
  [
    '2024-01-02T03:04:05.0000005Z',
    {
      timestamp: '2024-01-02 03:04:05',
      timestamptz: '2024-01-02 03:04:05+00',
      date: '2024-01-02',
      time: '03:04:05',
      timetz: '03:04:05+00',
    },
  ],
  [
    '2024-01-02T03:04:05.0000015Z',
    {
      timestamp: '2024-01-02 03:04:05.000002',
      timestamptz: '2024-01-02 03:04:05.000002+00',
      date: '2024-01-02',
      time: '03:04:05.000002',
      timetz: '03:04:05.000002+00',
    },
  ],
  [
    '2024-12-31T23:59:59.9999995Z',
    {
      timestamp: '2025-01-01 00:00:00',
      timestamptz: '2025-01-01 00:00:00+00',
      date: '2024-12-31',
      time: '24:00:00',
      timetz: '24:00:00+00',
    },
  ],
  [
    '2024-12-31T23:59:59.5Z',
    {
      timestamp: '2024-12-31 23:59:59.5',
      timestamptz: '2024-12-31 23:59:59.5+00',
      date: '2024-12-31',
      time: '23:59:59.5',
      timetz: '23:59:59.5+00',
    },
  ],
  [
    '2024-12-31T23:59:60Z',
    {
      timestamp: '2025-01-01 00:00:00',
      timestamptz: '2025-01-01 00:00:00+00',
      date: '2024-12-31',
      time: '24:00:00',
      timetz: '24:00:00+00',
    },
  ],
  [
    '1999-12-31T23:59:58.5Z',
    {
      timestamp: '1999-12-31 23:59:58.5',
      timestamptz: '1999-12-31 23:59:58.5+00',
      date: '1999-12-31',
      time: '23:59:58.5',
      timetz: '23:59:58.5+00',
    },
  ],
  [
    '1999-12-31T23:59:59.5Z',
    {
      timestamp: '1999-12-31 23:59:59.5',
      timestamptz: '1999-12-31 23:59:59.5+00',
      date: '1999-12-31',
      time: '23:59:59.5',
      timetz: '23:59:59.5+00',
    },
  ],
  [
    '1970-01-01T12:34:56.100Z',
    {
      timestamp: '1970-01-01 12:34:56.1',
      timestamptz: '1970-01-01 12:34:56.1+00',
      date: '1970-01-01',
      time: '12:34:56.1',
      timetz: '12:34:56.1+00',
    },
  ],
  [
    '0999-06-15T10:20:30.25Z',
    {
      timestamp: '0999-06-15 10:20:30.25',
      timestamptz: '0999-06-15 10:20:30.25+00',
      date: '0999-06-15',
      time: '10:20:30.25',
      timetz: '10:20:30.25+00',
    },
  ],
  [
    '0001-01-01T00:30:00+01:00',
    {
      timestamp: '0001-01-01 00:30:00',
      timestamptz: '0001-12-31 23:30:00+00 BC',
      date: '0001-01-01',
      time: '00:30:00',
      timetz: '00:30:00+01',
    },
  ],
  [
    '0001-01-01T00:00:00.5+00:01',
    {
      timestamp: '0001-01-01 00:00:00.5',
      timestamptz: '0001-12-31 23:59:00.5+00 BC',
      date: '0001-01-01',
      time: '00:00:00.5',
      timetz: '00:00:00.5+00:01',
    },
  ],
];

type Kind = 'timestamp' | 'timestamptz' | 'date' | 'time' | 'timetz';

/** Each type with its tag's reader, which reads the text Postgres prints as well as ISO 8601. */
const types: readonly (readonly [Kind, string, (text: string) => string])[] = [
  ['timestamp', pgTimestamp.id, pgTimestampCanonical],
  ['timestamptz', pgTimestamptz.id, pgTimestamptzCanonical],
  ['date', pgDate.id, pgDateCanonical],
  ['time', pgTime.id, pgTimeCanonical],
  ['timetz', pgTimetz.id, pgTimetzCanonical],
];

/**
 * A written value Postgres rounds or carries before storing it: more than six fraction digits, or
 * second 60. The tag holds only what the type stores, so it refuses these instead of rounding.
 */
function postgresRounds(written: string): boolean {
  return /\.\d{7,}/.test(written) || /:60(?:[.Zz+-]|$)/.test(written);
}

function read(parse: (text: string) => string, text: string | undefined): string {
  if (text === undefined) return 'unread';
  try {
    return parse(text);
  } catch {
    return 'refused';
  }
}

describe('prisma7TemporalTagBody, read by the type tag', () => {
  it.each(storedByPostgres)(
    'stores the value Postgres stores for %s, or refuses one Postgres rounds',
    (written, stored) => {
      const rounds = postgresRounds(written);
      expect(
        Object.fromEntries(
          types.map(([kind, id, parse]) => [
            kind,
            read(parse, prisma7TemporalTagBody(written, id)),
          ]),
        ),
      ).toEqual(
        Object.fromEntries(
          types.map(([kind, , parse]) => [
            kind,
            rounds && kind !== 'date' ? 'refused' : read(parse, stored[kind]),
          ]),
        ),
      );
    },
  );

  it('reads nothing from text that is not an RFC 3339 date and time', () => {
    expect(
      [
        '2024-01-02',
        '2024-01-02T03:04:05',
        '2024-01-02T03:04Z',
        '2024-01-02T03:04:05+0200',
        '+002024-01-02T03:04:05Z',
      ].map((text) => prisma7TemporalTagBody(text, pgTimestamp.id)),
    ).toEqual([undefined, undefined, undefined, undefined, undefined]);
  });

  it('gives no body for a type that is not a date or time type', () => {
    expect(prisma7TemporalTagBody('2024-01-02T03:04:05Z', 'pg/interval')).toBeUndefined();
  });
});
