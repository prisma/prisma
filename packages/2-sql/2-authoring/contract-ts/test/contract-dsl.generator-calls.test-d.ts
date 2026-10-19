import { gen } from '@internal/framework-components/authoring';
import { expectTypeOf, test } from 'vitest';
import { field } from '../src/exports/contract-builder';
import { columnDescriptor } from './helpers/column-descriptor';

const textColumn = columnDescriptor('pg/text@1');

/** Whether the contract types say the client generates the field's value on create, which makes the create input optional. */
type GeneratesOnCreate<Builder> = Builder extends { readonly __state: infer State }
  ? State extends { readonly __defaultPresence?: infer Presence }
    ? NonNullable<Presence> extends { readonly execution: true }
      ? true
      : false
    : false
  : false;

test('.onCreate makes the client generate the value on create, so the create input may omit it', () => {
  const onCreate = field.column(textColumn).onCreate(gen.uuid());
  expectTypeOf<GeneratesOnCreate<typeof onCreate>>().toEqualTypeOf<true>();
});

test('.onUpdate alone leaves the value required on create', () => {
  const onUpdate = field.column(textColumn).onUpdate(gen.now());
  expectTypeOf<GeneratesOnCreate<typeof onUpdate>>().toEqualTypeOf<false>();
});

test('.onCreate after .onUpdate still generates on create', () => {
  const both = field.column(textColumn).onUpdate(gen.now()).onCreate(gen.now());
  expectTypeOf<GeneratesOnCreate<typeof both>>().toEqualTypeOf<true>();
});
