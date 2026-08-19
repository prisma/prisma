import { InternalError } from '@internal/utils/internal-error';
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

    it('gives an aggregate the codec its target declares for the result', () => {
      expect(entriesFor('aggregate include')).toEqual(['value:codec(pg/int8number@1)']);
      expect(entriesFor('aggregate include over a column')).toEqual([
        'value:codec(pg/int8number@1)',
      ]);
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
        'value:codec(pg/int8number@1)',
      ]);
    });

    it('reaches the child columns of a many-to-many include across the junction', () => {
      expect(entriesFor('many-to-many include')).toEqual([
        '[]:document',
        'id:codec(sql/char@1)',
        'name:codec(pg/text@1)',
      ]);
    });

    // Nothing the planner puts into JSON is left unidentified any more.
    // A native entry says "read this back as whatever JSON.parse makes of it",
    // which for a count past 2^53 is a rounded number — so the absence of
    // native entries is the invariant, not a list of permitted ones.
    it('leaves no entry native — every value it emits states its identity', () => {
      const natives = [...planned].flatMap(([label, ast]) =>
        jsonEntriesOf(ast)
          .filter((entry) => entry.endsWith(':native'))
          .map((entry) => `${label} ${entry}`),
      );

      expect(natives).toEqual([]);
    });
  });
});
