import { pgDate, pgTime, pgTimestamp, pgTimestamptz, pgTimetz } from './data-types';

const RFC_3339 = /^(\d{4}-\d{2}-\d{2})[Tt ](\d{2}:\d{2}:\d{2}(?:\.\d+)?)([Zz]|[+-]\d{2}:\d{2})$/;

/**
 * What a Prisma 7 `DateTime` default, such as `2024-01-02T03:04:05.123+02:00`, means on a column of `dataType`, as the body of the type's tag: `date` keeps the written date, `time` and `timestamp` the written wall-clock time without the offset, `timetz` the time with the written offset, and `timestamptz` the written instant, offset included. The tag reads the body as Postgres reads the default Prisma 7 writes. `undefined` for text that is not an RFC 3339 date and time, or a type that is not a date or time type.
 */
export function prisma7TemporalTagBody(text: string, dataType: string): string | undefined {
  const match = RFC_3339.exec(text);
  if (match === null) return undefined;
  const [, date = '', clock = '', zone = ''] = match;
  const offset = zone.toUpperCase();
  switch (dataType) {
    case pgDate.id:
      return date;
    case pgTime.id:
      return clock;
    case pgTimetz.id:
      return `${clock}${offset}`;
    case pgTimestamp.id:
      return `${date}T${clock}`;
    case pgTimestamptz.id:
      return `${date}T${clock}${offset}`;
    default:
      return undefined;
  }
}
