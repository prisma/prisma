import type { CodecCallContext } from '@internal/framework-components/codec';
import { expectTypeOf, test } from 'vitest';
import type { Codec, SqlCodecCallContext, SqlColumnRef } from '../../src/ast/codec-types';
import { defineTestCodec } from './test-codec';

test('SqlCodecCallContext extends framework CodecCallContext (signal) and adds column', () => {
  type Signal = NonNullable<SqlCodecCallContext['signal']>;
  expectTypeOf<Signal>().toEqualTypeOf<AbortSignal>();
  type Column = NonNullable<SqlCodecCallContext['column']>;
  expectTypeOf<Column>().toEqualTypeOf<SqlColumnRef>();
  // SqlCodecCallContext is assignable to CodecCallContext (extension).
  const sql: SqlCodecCallContext = { signal: new AbortController().signal };
  const fw: CodecCallContext = sql;
  void fw;
});

test('SQL Codec.encode/decode narrow ctx to SqlCodecCallContext (non-optional at the interface)', () => {
  type SqlCodec = Codec<'demo/x@1', readonly [], string, string>;
  type EncodeParams = Parameters<SqlCodec['encode']>;
  type DecodeParams = Parameters<SqlCodec['decode']>;
  expectTypeOf<EncodeParams[1]>().toEqualTypeOf<SqlCodecCallContext>();
  expectTypeOf<DecodeParams[1]>().toEqualTypeOf<SqlCodecCallContext>();
});

test('Codec.encode and Codec.decode require a ctx argument', () => {
  const c = defineTestCodec({
    typeId: 'demo/require-ctx@1',
    encode: (value: string) => value,
    decode: (wire: string) => wire,
  });
  // @ts-expect-error — ctx is non-optional on the Codec interface
  c.encode('x');
  // @ts-expect-error — ctx is non-optional on the Codec interface
  c.decode('x');
  // Legal: explicit ctx (signal is the only field today and is optional inside the ctx).
  void c.encode('x', {});
  void c.decode('x', {});
});
