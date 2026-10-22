import { describe, expect, it } from 'vitest';
import { readPsl } from '../psl-print/print-and-read-back';

const model = (...fields: readonly string[]) =>
  [
    '// use prisma-8',
    '',
    'model Order {',
    '  id Int @id',
    ...fields.map((f) => `  ${f}`),
    '}',
    '',
  ].join('\n');

const rows: readonly (readonly [convenience: string, explicit: string])[] = [
  ['DateTime', 'TimestamptzJsDate(3)'],
  ['DateTime(value: temporal)', 'TimestamptzTemporal'],
  ['DateTime(value: string)', 'TimestamptzString'],
  ['DateTime(column: timestamp)', 'TimestampJsDate(3)'],
  ['DateTime(value: temporal, column: timestamp)', 'TimestampInstant'],
  ['DateTime(value: string, column: timestamp)', 'TimestampString'],
  ['DateTime(value: string, precision: 6)', 'TimestamptzString(6)'],
  ['DateTime(precision: 6)', 'TimestamptzJsDate(6)'],
  ['DateTime(temporal, timestamptz, 3)', 'TimestamptzTemporal(3)'],
  ['Date', 'DateString'],
  ['Date(value: temporal)', 'DateTemporal'],
  ['Time', 'TimeString'],
  ['Time(precision: 0)', 'TimeString(0)'],
  ['Time(value: temporal)', 'TimeTemporal'],
  ['Time(column: timetz)', 'Timetz'],
  ['Duration', 'IntervalString'],
  ['Duration(precision: 3)', 'IntervalString(3)'],
  ['Duration(value: parts)', 'IntervalParts'],
  ['DateTime[]', 'TimestamptzJsDate(3)[]'],
  ['DateTime?', 'TimestamptzJsDate(3)?'],
];

describe('a convenience date and time type', () => {
  it.each(rows)('%s emits the contract %s emits', async (convenience, explicit) => {
    expect(await readPsl(model(`at ${convenience}`))).toEqual(
      await readPsl(model(`at ${explicit}`)),
    );
  });

  it('chooses the generator now() writes for the type it becomes', async () => {
    expect(
      await readPsl(
        model(
          'createdAt DateTime @onCreate(now())',
          'updatedAt DateTime @onCreate(now()) @onUpdate(now())',
          'day       Date @onCreate(now())',
          'clock     Time(precision: 0) @onCreate(now())',
          'instant   DateTime(value: temporal) @onCreate(now())',
        ),
      ),
    ).toEqual(
      await readPsl(
        model(
          'createdAt TimestamptzJsDate(3) @onCreate(now())',
          'updatedAt TimestamptzJsDate(3) @onCreate(now()) @onUpdate(now())',
          'day       DateString @onCreate(now())',
          'clock     TimeString(0) @onCreate(now())',
          'instant   TimestamptzTemporal @onCreate(now())',
        ),
      ),
    );
  });

  it('reads a @default as the type it becomes, through a types {} alias too', async () => {
    const convenience = `// use prisma-8

types {
  Stamp = DateTime(column: timestamp) @default(timestamp\`2024-01-01 00:00:00\`)
}

model Order {
  id     Int   @id
  placed Stamp
  day    Date  @default(date\`2024-02-29\`)
}
`;
    expect(await readPsl(convenience)).toEqual(
      await readPsl(
        model(
          'placed TimestampJsDate(3) @default(timestamp`2024-01-01 00:00:00`)',
          'day    DateString @default(date`2024-02-29`)',
        ),
      ),
    );
  });

  it('refuses a default of another date and time type, naming the column’s', async () => {
    await expect(
      readPsl(model('at DateTime(column: timestamp) @default(timestamptz`2024-01-01T00:00:00Z`)')),
    ).rejects.toThrow(/PSL_VALUE_TYPE_INCOMPATIBLE.*Expected timestamp`\.\.\.`/);
  });

  it.each([
    [
      'Time(value: temporal, column: timetz)',
      'Argument \\"column\\" of Time cannot be timetz when value is temporal; write one of: time.',
    ],
    [
      'Date(value: jsDate)',
      'Argument \\"value\\" of Date is jsDate; write one of: string, temporal.',
    ],
    [
      'Duration(value: parts, column: date)',
      'Argument \\"column\\" of Duration is date; write one of: interval.',
    ],
  ])('refuses %s at the argument, naming the accepted choices', async (written, message) => {
    await expect(readPsl(model(`at ${written}`))).rejects.toThrow(message);
  });

  it('refuses a precision the type it becomes does not take', async () => {
    await expect(readPsl(model('at Date(precision: 3)'))).rejects.toThrow(
      'received unknown named argument \\"precision\\"',
    );
  });
});
