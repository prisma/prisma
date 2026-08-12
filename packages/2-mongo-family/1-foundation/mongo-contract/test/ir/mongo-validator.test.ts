import { IRNodeBase } from '@internal/framework-components/ir';
import { describe, expect, it } from 'vitest';
import { MongoValidator } from '../../src/ir/mongo-validator';

describe('MongoValidator', () => {
  it('constructs with required validator fields', () => {
    const v = new MongoValidator({
      jsonSchema: { bsonType: 'object', properties: { name: { bsonType: 'string' } } },
      validationLevel: 'strict',
      validationAction: 'error',
    });
    expect(v.kind).toBe('mongo-validator');
    expect(v.jsonSchema).toEqual({
      bsonType: 'object',
      properties: { name: { bsonType: 'string' } },
    });
    expect(v.validationLevel).toBe('strict');
    expect(v.validationAction).toBe('error');
  });

  it('supports moderate validation level + warn action', () => {
    const v = new MongoValidator({
      jsonSchema: {},
      validationLevel: 'moderate',
      validationAction: 'warn',
    });
    expect(v.validationLevel).toBe('moderate');
    expect(v.validationAction).toBe('warn');
  });

  it('extends IRNodeBase and freezes', () => {
    const v = new MongoValidator({
      jsonSchema: {},
      validationLevel: 'strict',
      validationAction: 'error',
    });
    expect(v).toBeInstanceOf(IRNodeBase);
    expect(v).toBeInstanceOf(MongoValidator);
    expect(Object.isFrozen(v)).toBe(true);
    expect(() => {
      Object.assign(v, { validationLevel: 'moderate' });
    }).toThrow();
  });

  it('round-trips through canonical JSON with kind included', () => {
    const v = new MongoValidator({
      jsonSchema: { bsonType: 'object' },
      validationLevel: 'strict',
      validationAction: 'error',
    });
    expect(JSON.parse(JSON.stringify(v))).toEqual({
      kind: 'mongo-validator',
      jsonSchema: { bsonType: 'object' },
      validationLevel: 'strict',
      validationAction: 'error',
    });
  });
});
