import { RawQueryAst } from '@internal/sql-relational-core/ast';
import { describe, expect, it } from 'vitest';
import { buildDecodeContext, decodeRow } from '../src/codecs/decoding';
import { defineTestCodec } from './test-codec';
import { buildTestContractCodecs } from './utils';

const contractCodecs = buildTestContractCodecs([
  defineTestCodec({
    typeId: 'test/int@1',
    targetTypes: ['int4'],
    encode: (v: number) => v,
    decode: (w: number) => w * 10,
  }),
  defineTestCodec({
    typeId: 'test/text@1',
    targetTypes: ['text'],
    encode: (v: string) => v,
    decode: (w: string) => `decoded:${w}`,
  }),
]);

const rowsAst = RawQueryAst.rows(['select id, email from "user"'], {
  id: { codecId: 'test/int@1', nullable: false },
  email: { codecId: 'test/text@1', nullable: true },
});

const affectedCountAst = RawQueryAst.affectedCount(['update "user" set seen = now()']);

describe('raw-query decode context', () => {
  it('takes its aliases and codecs from the declared row spec', () => {
    const ctx = buildDecodeContext(rowsAst, contractCodecs);

    expect(ctx.aliases).toEqual(['id', 'email']);
    expect(ctx.codecs.get('id')?.id).toBe('test/int@1');
    expect(ctx.codecs.get('email')?.id).toBe('test/text@1');
  });

  it('declares no aliases for an affected-count statement', () => {
    const ctx = buildDecodeContext(affectedCountAst, contractCodecs);

    expect(ctx.aliases).toBeUndefined();
    expect(ctx.codecs.size).toBe(0);
  });
});

describe('raw-query row decoding', () => {
  it('decodes each column through the codec its spec declares', async () => {
    const decoded = await decodeRow(
      { id: 4, email: 'a@b.example' },
      buildDecodeContext(rowsAst, contractCodecs),
      {},
    );

    expect(decoded).toEqual({ id: 40, email: 'decoded:a@b.example' });
  });

  it('passes a null wire value through for a nullable column', async () => {
    const decoded = await decodeRow(
      { id: 4, email: null },
      buildDecodeContext(rowsAst, contractCodecs),
      {},
    );

    expect(decoded).toEqual({ id: 40, email: null });
  });

  it('drops result columns the spec does not declare', async () => {
    const decoded = await decodeRow(
      { id: 4, email: 'a@b.example', surplus: 'ignored' },
      buildDecodeContext(rowsAst, contractCodecs),
      {},
    );

    expect(decoded).toEqual({ id: 40, email: 'decoded:a@b.example' });
  });

  it('raises RUNTIME.RAW_ROW_COLUMN_MISSING when the result omits a declared column', async () => {
    await expect(
      decodeRow({ id: 4 }, buildDecodeContext(rowsAst, contractCodecs), {}),
    ).rejects.toMatchObject({
      code: 'RUNTIME.RAW_ROW_COLUMN_MISSING',
      details: {
        column: 'email',
        declaredColumns: ['id', 'email'],
        resultColumns: ['id'],
      },
    });
  });

  it('leaves an affected-count row untouched', async () => {
    const decoded = await decodeRow(
      { affectedRows: 3 },
      buildDecodeContext(affectedCountAst, contractCodecs),
      {},
    );

    expect(decoded).toEqual({ affectedRows: 3 });
  });
});
