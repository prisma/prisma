/**
 * Property tests for the SQLite adapter descriptor-meta codec filter invariant.
 *
 * The filter `d.renderOutputType === undefined` selects which codec descriptors
 * go into the execution codec lookup. That filter works today because the set of
 * codecs that emit named TypeScript types (Char<N>, Varchar<N>) is disjoint from
 * the set needed at execution time. These tests make that invariant explicit: if a
 * future codec gains renderOutputType for an unrelated reason, or if an execution
 * codec needs a named type added, the failure is loud rather than silent.
 *
 * See `descriptor-meta.ts` for the filter and its comment. These tests exist
 * because filtering execution codecs on an emit-renderer property previously
 * re-broke codec lookup three times before the invariant was made explicit here.
 */

import { SQL_CHAR_CODEC_ID, SQL_VARCHAR_CODEC_ID } from '@internal/sql-relational-core/ast';
import { sqliteCodecRegistry } from '@internal/target-sqlite/codecs';
import { describe, expect, it } from 'vitest';
import { sqliteAdapterDescriptorMeta } from '../src/core/descriptor-meta';

const executionCodecDescriptors = sqliteAdapterDescriptorMeta.types.codecTypes.codecDescriptors;

describe('SQLite descriptor-meta codec filter invariant', () => {
  it('every codec in the execution set has no renderOutputType', () => {
    for (const d of executionCodecDescriptors) {
      expect(d.renderOutputType, `${d.codecId} must not emit a named TS type`).toBeUndefined();
    }
  });

  it('every codec excluded from the execution set carries a renderOutputType', () => {
    const executionIds = new Set(executionCodecDescriptors.map((d) => d.codecId));
    const excluded = Array.from(sqliteCodecRegistry.values()).filter(
      (d) => !executionIds.has(d.codecId),
    );
    for (const d of excluded) {
      expect(
        d.renderOutputType,
        `${d.codecId} is excluded from execution lookup but has no renderOutputType — if it needs execution registration, add it to the explicit execution set`,
      ).toBeDefined();
    }
  });

  it('the only excluded codec ids are the named-type emitters (sql/char@1, sql/varchar@1)', () => {
    const executionIds = new Set(executionCodecDescriptors.map((d) => d.codecId));
    const excludedIds = Array.from(sqliteCodecRegistry.values())
      .filter((d) => !executionIds.has(d.codecId))
      .map((d) => d.codecId)
      .sort();
    expect(excludedIds).toEqual([SQL_CHAR_CODEC_ID, SQL_VARCHAR_CODEC_ID].sort());
  });
});
