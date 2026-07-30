import { InternalError } from '@prisma-next/utils/internal-error';
import { describe, expect, it } from 'vitest';
import { jsonEntriesOf, representativePlans } from './json-projection-plans';

describe('JSON projection emission', () => {
  /**
   * What the planner now states about each entry it emits. These fail if the
   * planner stops choosing variants — which the SQL baseline below cannot
   * catch, since an unchosen variant renders exactly like a chosen one.
   */
  describe('states the identity of every value it puts into JSON', () => {
    const planned = new Map(representativePlans());

    function entriesFor(label: string): string[] {
      const ast = planned.get(label);
      if (ast === undefined) throw new InternalError(`no representative plan labelled '${label}'`);
      return jsonEntriesOf(ast);
    }

    it('gives a child row set codec entries for its columns and a document for the row', () => {
      expect(entriesFor('plain include')).toEqual([
        '[]:document',
        'embedding:codec(pg/vector@1)',
        'id:codec(pg/int4@1)',
        'title:codec(pg/text@1)',
        'user_id:codec(pg/int4@1)',
        'views:codec(pg/int4@1)',
      ]);
    });

    it('gives a nested include a document entry, and its own columns codec entries', () => {
      expect(entriesFor('nested include')).toEqual([
        '[]:document',
        'embedding:codec(pg/vector@1)',
        'id:codec(pg/int4@1)',
        'title:codec(pg/text@1)',
        'user_id:codec(pg/int4@1)',
        'views:codec(pg/int4@1)',
        'comments:document',
        '[]:document',
        'body:codec(pg/text@1)',
        'id:codec(pg/int4@1)',
        'post_id:codec(pg/int4@1)',
      ]);
    });

    it('leaves an aggregate native — a computed value carries no codec', () => {
      expect(entriesFor('aggregate include')).toEqual(['value:native']);
      expect(entriesFor('aggregate include over a column')).toEqual(['value:native']);
    });

    it('gives every combine branch a document entry, whatever the branch is', () => {
      expect(entriesFor('combine of a row branch and a scalar branch')).toEqual([
        'recent:document',
        'total:document',
        '[]:document',
        'embedding:codec(pg/vector@1)',
        'id:codec(pg/int4@1)',
        'title:codec(pg/text@1)',
        'user_id:codec(pg/int4@1)',
        'views:codec(pg/int4@1)',
        'value:native',
      ]);
    });

    it('keeps the identities through the ranked distinct path', () => {
      expect(entriesFor('distinct non-leaf include')).toEqual([
        '[]:document',
        'embedding:codec(pg/vector@1)',
        'id:codec(pg/int4@1)',
        'title:codec(pg/text@1)',
        'user_id:codec(pg/int4@1)',
        'views:codec(pg/int4@1)',
        'comments:document',
        '[]:document',
        'body:codec(pg/text@1)',
        'id:codec(pg/int4@1)',
        'post_id:codec(pg/int4@1)',
      ]);
    });

    it('reaches the child columns of a many-to-many include across the junction', () => {
      expect(entriesFor('many-to-many include')).toEqual([
        '[]:document',
        'id:codec(sql/char@1)',
        'name:codec(pg/text@1)',
      ]);
    });

    it('no entry is left native except the aggregates', () => {
      const natives = [...planned].flatMap(([label, ast]) =>
        jsonEntriesOf(ast)
          .filter((entry) => entry.endsWith(':native'))
          .map((entry) => `${label} ${entry}`),
      );

      expect(natives).toEqual([
        'aggregate include value:native',
        'aggregate include over a column value:native',
        'combine of a row branch and a scalar branch value:native',
      ]);
    });
  });
});
