import { afterEach, describe, expect, it } from 'vitest';
import { sqliteDatetimeDescriptor } from '../src/core/codecs';

const codec = sqliteDatetimeDescriptor.factory()({ name: 'at' });
const originalTimeZone = process.env['TZ'];

afterEach(() => {
  if (originalTimeZone === undefined) delete process.env['TZ'];
  else process.env['TZ'] = originalTimeZone;
});

describe('sqlite/datetime@1 reads text without an offset as UTC, as SQLite does', () => {
  it.each(['UTC', 'Asia/Kolkata'])('under TZ=%s', async (timeZone) => {
    process.env['TZ'] = timeZone;
    const read = async (wire: string) => (await codec.fromWire(wire, {})).toISOString();
    expect({
      spaced: await read('2024-01-01 00:00:00'),
      fraction: await read('2024-01-01 12:34:56.5'),
      minutes: await read('2024-01-01T12:34'),
      dateOnly: await read('2024-01-01'),
      offset: await read('2024-01-01T05:30:00+05:30'),
      stored: await read('2024-01-01T00:00:00.000Z'),
    }).toEqual({
      spaced: '2024-01-01T00:00:00.000Z',
      fraction: '2024-01-01T12:34:56.500Z',
      minutes: '2024-01-01T12:34:00.000Z',
      dateOnly: '2024-01-01T00:00:00.000Z',
      offset: '2024-01-01T00:00:00.000Z',
      stored: '2024-01-01T00:00:00.000Z',
    });
  });

  it.each(['Jan 1 2024', '2024', 'not a date'])(
    'refuses %j, which is not ISO 8601',
    async (wire) => {
      await expect(codec.fromWire(wire, {})).rejects.toMatchObject({
        code: 'RUNTIME.DECODE_FAILED',
      });
    },
  );
});
