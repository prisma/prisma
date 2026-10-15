import type { MutationDefaultGeneratorDescriptor } from '@internal/framework-components/control';
import { requireTemporal } from './require-temporal';

/**
 * The "now" generators for the date and time codecs that `timestampNow`, `instantNow` and `plainDateTimeNow` do not serve. All read the UTC clock. The text generators write the text PostgreSQL prints in a UTC session, with milliseconds and no trailing zeros in the fraction.
 */
export const TIMESTAMP_TEXT_NOW_GENERATOR_ID = 'timestampTextNow' as const;
export const TIMESTAMPTZ_TEXT_NOW_GENERATOR_ID = 'timestamptzTextNow' as const;
export const DATE_TEXT_NOW_GENERATOR_ID = 'dateTextNow' as const;
export const TIME_TEXT_NOW_GENERATOR_ID = 'timeTextNow' as const;
export const TIMETZ_TEXT_NOW_GENERATOR_ID = 'timetzTextNow' as const;
export const PLAIN_DATE_NOW_GENERATOR_ID = 'plainDateNow' as const;
export const PLAIN_TIME_NOW_GENERATOR_ID = 'plainTimeNow' as const;

const UTC_OFFSET = '+00';

function utcNow(): { readonly date: string; readonly time: string } {
  const iso = new Date().toISOString();
  const [wholeSeconds = '', fraction = ''] = iso.slice(11, -1).split('.');
  const fractionDigits = fraction.replace(/0+$/, '');
  return {
    date: iso.slice(0, 10),
    time: fractionDigits === '' ? wholeSeconds : `${wholeSeconds}.${fractionDigits}`,
  };
}

export function timestampTextNow(): string {
  const { date, time } = utcNow();
  return `${date} ${time}`;
}

export function timestamptzTextNow(): string {
  return `${timestampTextNow()}${UTC_OFFSET}`;
}

export function dateTextNow(): string {
  return utcNow().date;
}

export function timeTextNow(): string {
  return utcNow().time;
}

export function timetzTextNow(): string {
  return `${timeTextNow()}${UTC_OFFSET}`;
}

export function plainDateNow(): Temporal.PlainDate {
  return requireTemporal({ generatorId: PLAIN_DATE_NOW_GENERATOR_ID }).Now.plainDateISO('UTC');
}

export function plainTimeNow(): Temporal.PlainTime {
  return requireTemporal({ generatorId: PLAIN_TIME_NOW_GENERATOR_ID }).Now.plainTimeISO('UTC');
}

export const postgresDateTimeNowGenerators = [
  { id: TIMESTAMP_TEXT_NOW_GENERATOR_ID, generate: timestampTextNow },
  { id: TIMESTAMPTZ_TEXT_NOW_GENERATOR_ID, generate: timestamptzTextNow },
  { id: DATE_TEXT_NOW_GENERATOR_ID, generate: dateTextNow },
  { id: TIME_TEXT_NOW_GENERATOR_ID, generate: timeTextNow },
  { id: TIMETZ_TEXT_NOW_GENERATOR_ID, generate: timetzTextNow },
  { id: PLAIN_DATE_NOW_GENERATOR_ID, generate: plainDateNow },
  { id: PLAIN_TIME_NOW_GENERATOR_ID, generate: plainTimeNow },
] as const satisfies ReadonlyArray<{ readonly id: string; readonly generate: () => unknown }>;

export function postgresDateTimeNowControlDescriptors(): readonly MutationDefaultGeneratorDescriptor[] {
  return postgresDateTimeNowGenerators.map(({ id }) => ({
    id,
    buildPhases: () => ({
      onCreate: { kind: 'generator', id },
      onUpdate: { kind: 'generator', id },
    }),
  }));
}
