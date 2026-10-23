import { describe, expect, it } from 'vitest';
import { buildPostgresCodecDescriptorRegistry } from '../src/core/codec-descriptor';
import { postgresCodecDescriptorRegistry } from '../src/core/registry';

const DECLARATIONS = ['string', 'number', 'boolean', 'anyJson', 'presenceOnly'];

describe('the JSON type a codec declares for a value object member', () => {
  it('is declared by every Postgres and SQL family codec', () => {
    const undeclared = [...postgresCodecDescriptorRegistry.values()]
      .filter((descriptor) => !DECLARATIONS.includes(descriptor.valueObjectJsonType))
      .map((descriptor) => descriptor.codecId);
    expect(undeclared).toEqual([]);
  });

  it('is the type the SQL ORM writes, for the codecs that write one', () => {
    expect(
      Object.fromEntries(
        [
          'sql/text@1',
          'sql/int@1',
          'pg/numeric@1',
          'pg/bool@1',
          'pg/jsonb@1',
          'pg/int8@1',
          'pg/timestamp-date@1',
          'pg/timestamp-instant@1',
          'pg/interval-string@1',
        ].map((codecId) => [
          codecId,
          postgresCodecDescriptorRegistry.descriptorFor(codecId)?.valueObjectJsonType,
        ]),
      ),
    ).toEqual({
      'sql/text@1': 'string',
      'sql/int@1': 'number',
      'pg/numeric@1': 'string',
      'pg/bool@1': 'boolean',
      'pg/jsonb@1': 'anyJson',
      'pg/int8@1': 'presenceOnly',
      'pg/timestamp-date@1': 'string',
      'pg/timestamp-instant@1': 'string',
      'pg/interval-string@1': 'string',
    });
  });

  it('is required of a descriptor the registry accepts', () => {
    const text = postgresCodecDescriptorRegistry.descriptorFor('pg/text@1');
    const { valueObjectJsonType: _declared, ...undeclared } = {
      descriptorKind: text?.descriptorKind,
      codecId: 'demo/undeclared@1',
      traits: text?.traits,
      paramsSchema: undefined,
      isParameterized: false,
      factory: text?.factory.bind(text),
      projectJson: text?.projectJson.bind(text),
      valueObjectJsonType: text?.valueObjectJsonType,
    };
    expect(() => buildPostgresCodecDescriptorRegistry([undeclared])).toThrow(
      expect.objectContaining({ code: 'RUNTIME.CODEC_DESCRIPTOR_INVALID' }),
    );
  });
});
