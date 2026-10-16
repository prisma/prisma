import { describe, expect, it } from 'vitest';
import { recursiveGroupsOf, typeKey } from '../src/recursive-groups';
import { embedMany, embedOne, model, objectId } from './collection-validator-helpers';
import { scalarField, voArrayField, voField } from './derive-json-schema-helpers';

const vo = (name: string) => typeKey('valueObject', name);

describe('recursiveGroupsOf', () => {
  it('puts a value object that refers to itself in its own group', () => {
    const groups = recursiveGroupsOf(
      { NavItem: { fields: { children: voArrayField('NavItem') } } },
      {},
    );
    expect(groups.has(vo('NavItem'))).toBe(true);
  });

  it('puts value objects that reach each other in one group, and leaves the others out', () => {
    const groups = recursiveGroupsOf(
      {
        A: { fields: { b: voField('B'), icon: voField('Icon') } },
        B: { fields: { a: voField('A') } },
        C: { fields: { a: voField('A') } },
        Icon: { fields: { name: scalarField('mongo/string@1') } },
      },
      {},
    );
    expect(groups.get(vo('A'))).toBeDefined();
    expect(groups.get(vo('B'))).toBe(groups.get(vo('A')));
    expect([groups.has(vo('C')), groups.has(vo('Icon'))]).toEqual([false, false]);
  });

  it('follows embed relations between models', () => {
    const groups = recursiveGroupsOf(
      {},
      {
        Root: model({ _id: objectId() }, { relations: { a: embedOne('A') } }),
        A: model({}, { relations: { b: embedMany('B') } }),
        B: model({}, { relations: { a: embedOne('A') } }),
      },
    );
    expect(groups.get(typeKey('model', 'A'))).toBe(groups.get(typeKey('model', 'B')));
    expect(groups.has(typeKey('model', 'Root'))).toBe(false);
  });
});
