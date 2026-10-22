import type { DefaultModelRow } from '@internal/sql-orm-client';
import type { CodecTypes } from '@internal/target-postgres/codec-types';
import type { Temporal } from 'temporal-spec';
import { expectTypeOf, test } from 'vitest';
import { defineContract } from '../../src/exports/contract-builder';

const contract = defineContract({}, ({ type, field, model }) => ({
  models: {
    Event: model('Event', {
      fields: {
        id: field.id.uuidv4String(),
        at: field.column(type.TimestamptzTemporal(3)),
        local: field.column(type.TimestampTemporal()),
        day: field.column(type.DateTemporal()),
        opens: field.column(type.TimeTemporal(0)),
        utcAt: field.column(type.TimestampInstant(6)),
        utcDate: field.column(type.TimestampJsDate(3)),
        span: field.column(type.IntervalString(3)),
      },
    }),
  },
}));

type EventRow = DefaultModelRow<typeof contract, 'Event'>;

test('a Temporal field is typed precisely in a project without the global Temporal declarations', () => {
  expectTypeOf<EventRow['at']>().not.toBeAny();
  expectTypeOf<EventRow['at']>().toEqualTypeOf<Temporal.Instant>();
  expectTypeOf<EventRow['local']>().toEqualTypeOf<Temporal.PlainDateTime>();
  expectTypeOf<EventRow['day']>().toEqualTypeOf<Temporal.PlainDate>();
  expectTypeOf<EventRow['opens']>().toEqualTypeOf<Temporal.PlainTime>();
  expectTypeOf<EventRow['utcAt']>().not.toBeAny();
  expectTypeOf<EventRow['utcAt']>().toEqualTypeOf<Temporal.Instant>();
});

test('every Temporal codec names its type through an import', () => {
  expectTypeOf<CodecTypes['pg/timestamptz-temporal@1']['output']>().not.toBeAny();
  expectTypeOf<
    CodecTypes['pg/timestamptz-temporal@1']['output']
  >().toEqualTypeOf<Temporal.Instant>();
  expectTypeOf<
    CodecTypes['pg/timestamp-temporal@1']['output']
  >().toEqualTypeOf<Temporal.PlainDateTime>();
  expectTypeOf<CodecTypes['pg/date-temporal@1']['output']>().toEqualTypeOf<Temporal.PlainDate>();
  expectTypeOf<CodecTypes['pg/time-temporal@1']['output']>().toEqualTypeOf<Temporal.PlainTime>();
  expectTypeOf<CodecTypes['pg/timestamp-instant@1']['output']>().not.toBeAny();
  expectTypeOf<CodecTypes['pg/timestamp-instant@1']['output']>().toEqualTypeOf<Temporal.Instant>();
});

test('a timestamp read as a Date reads a Date, and an interval read as a string reads a string', () => {
  expectTypeOf<EventRow['utcDate']>().toEqualTypeOf<Date>();
  expectTypeOf<EventRow['span']>().toEqualTypeOf<string>();
});

const convenience = defineContract({}, ({ type, field, model }) => ({
  models: {
    Order: model('Order', {
      fields: {
        id: field.id.uuidv4String(),
        paidAt: field.column(type.DateTime()),
        settledAt: field.column(type.DateTime('temporal')),
        textAt: field.column(type.DateTime('string', undefined, 6)),
        legacyAt: field.column(type.DateTime(undefined, 'timestamp')),
        utcAt: field.column(type.DateTime('temporal', 'timestamp')),
        shipBy: field.column(type.Date()),
        shipOn: field.column(type.Date('temporal')),
        opensAt: field.column(type.Time(undefined, undefined, 0)),
        opensAtT: field.column(type.Time('temporal')),
        localAt: field.column(type.Time(undefined, 'timetz')),
        period: field.column(type.Duration()),
        parts: field.column(type.Duration('parts')),
        textAtExplicit: field.column(type.TimestamptzString(6)),
        opensAtExplicit: field.column(type.TimeString(0)),
        localAtExplicit: field.column(type.Timetz()),
        partsExplicit: field.column(type.IntervalParts()),
      },
    }),
  },
}));

type OrderRow = DefaultModelRow<typeof convenience, 'Order'>;

test('a convenience type is typed as the value of the explicit type it chooses', () => {
  expectTypeOf<OrderRow['paidAt']>().toEqualTypeOf<Date>();
  expectTypeOf<OrderRow['settledAt']>().toEqualTypeOf<Temporal.Instant>();
  expectTypeOf<OrderRow['textAt']>().toEqualTypeOf<OrderRow['textAtExplicit']>();
  expectTypeOf<OrderRow['legacyAt']>().toEqualTypeOf<Date>();
  expectTypeOf<OrderRow['utcAt']>().toEqualTypeOf<Temporal.Instant>();
  expectTypeOf<OrderRow['shipBy']>().toEqualTypeOf<string>();
  expectTypeOf<OrderRow['shipOn']>().toEqualTypeOf<Temporal.PlainDate>();
  expectTypeOf<OrderRow['opensAt']>().toEqualTypeOf<OrderRow['opensAtExplicit']>();
  expectTypeOf<OrderRow['opensAtT']>().toEqualTypeOf<Temporal.PlainTime>();
  expectTypeOf<OrderRow['localAt']>().toEqualTypeOf<OrderRow['localAtExplicit']>();
  expectTypeOf<OrderRow['period']>().toEqualTypeOf<string>();
  expectTypeOf<OrderRow['parts']>().not.toBeAny();
  expectTypeOf<OrderRow['parts']>().toEqualTypeOf<OrderRow['partsExplicit']>();
});

test('a convenience type helper refuses a combination with no explicit type', () => {
  defineContract({}, ({ type, field, model }) => ({
    models: {
      Order: model('Order', {
        fields: {
          id: field.id.uuidv4String(),
          // @ts-expect-error Temporal.PlainTime cannot hold a timetz offset
          at: field.column(type.Time('temporal', 'timetz')),
          // @ts-expect-error a calendar date is never a JavaScript Date
          day: field.column(type.Date('jsDate')),
        },
      }),
    },
  }));
});

test('each convenience type call has the type of the explicit type helper it chooses', () => {
  defineContract({}, ({ type }) => {
    expectTypeOf(type.DateTime()).toEqualTypeOf(type.TimestamptzJsDate(3));
    expectTypeOf(type.DateTime(undefined, undefined, 6)).toEqualTypeOf(type.TimestamptzJsDate(6));
    expectTypeOf(type.DateTime('jsDate', 'timestamptz')).toEqualTypeOf(type.TimestamptzJsDate(3));
    expectTypeOf(type.DateTime('temporal')).toEqualTypeOf(type.TimestamptzTemporal());
    expectTypeOf(type.DateTime('temporal', undefined, 3)).toEqualTypeOf(
      type.TimestamptzTemporal(3),
    );
    expectTypeOf(type.DateTime('string')).toEqualTypeOf(type.TimestamptzString());
    expectTypeOf(type.DateTime('string', 'timestamptz', 6)).toEqualTypeOf(
      type.TimestamptzString(6),
    );
    expectTypeOf(type.DateTime(undefined, 'timestamp')).toEqualTypeOf(type.TimestampJsDate(3));
    expectTypeOf(type.DateTime('jsDate', 'timestamp', 0)).toEqualTypeOf(type.TimestampJsDate(0));
    expectTypeOf(type.DateTime('temporal', 'timestamp')).toEqualTypeOf(type.TimestampInstant());
    expectTypeOf(type.DateTime('temporal', 'timestamp', 6)).toEqualTypeOf(type.TimestampInstant(6));
    expectTypeOf(type.DateTime('string', 'timestamp')).toEqualTypeOf(type.TimestampString());
    expectTypeOf(type.DateTime('string', 'timestamp', 3)).toEqualTypeOf(type.TimestampString(3));
    expectTypeOf(type.Date()).toEqualTypeOf(type.DateString());
    expectTypeOf(type.Date('string', 'date')).toEqualTypeOf(type.DateString());
    expectTypeOf(type.Date('temporal')).toEqualTypeOf(type.DateTemporal());
    expectTypeOf(type.Time()).toEqualTypeOf(type.TimeString());
    expectTypeOf(type.Time(undefined, undefined, 0)).toEqualTypeOf(type.TimeString(0));
    expectTypeOf(type.Time('temporal')).toEqualTypeOf(type.TimeTemporal());
    expectTypeOf(type.Time('temporal', 'time', 3)).toEqualTypeOf(type.TimeTemporal(3));
    expectTypeOf(type.Time('string', 'timetz')).toEqualTypeOf(type.Timetz());
    expectTypeOf(type.Time(undefined, 'timetz', 2)).toEqualTypeOf(type.Timetz(2));
    expectTypeOf(type.Duration()).toEqualTypeOf(type.IntervalString());
    expectTypeOf(type.Duration(undefined, undefined, 3)).toEqualTypeOf(type.IntervalString(3));
    expectTypeOf(type.Duration('parts')).toEqualTypeOf(type.IntervalParts());
    expectTypeOf(type.Duration('parts', 'interval', 6)).toEqualTypeOf(type.IntervalParts(6));
    const widened: number = 4;
    expectTypeOf(type.DateTime('string', undefined, widened)).toEqualTypeOf(
      type.TimestamptzString(widened),
    );
    expectTypeOf(type.DateTime(undefined, undefined, widened)).not.toEqualTypeOf(
      type.TimestamptzString(widened),
    );
    return { models: {} };
  });
});
