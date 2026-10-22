import { describe, expect, it } from 'vitest';
import {
  dbUpdateKeepDataEditAdvice,
  migrationPlanKeepDataEditAdvice,
} from '../../src/utils/keep-data-edit-advice';

const PROJECT = { cwd: '/work/app', configPath: undefined, dbGiven: false };
const edits = [
  {
    remove: 'this.removeStoredValue({ column: "status" })',
    replaceWith: 'this.replaceStoredValue({ column: "status" })',
  },
  {
    remove: 'this.removeStoredValue({ column: "tags" })',
    replaceWith: 'this.replaceStoredValue({ column: "tags" })',
  },
];

describe('the advice that keeps the data of a member that keeps its name with a new stored value', () => {
  it('under migration plan, names every edit to make in the migration.ts the command writes', () => {
    expect(migrationPlanKeepDataEditAdvice(PROJECT)('Status.ARCHIVED', edits)).toBe(
      'To keep that data, answer with --delete Status.ARCHIVED, then in the migration.ts this command writes replace this.removeStoredValue({ column: "status" }) with this.replaceStoredValue({ column: "status" }), and replace this.removeStoredValue({ column: "tags" }) with this.replaceStoredValue({ column: "tags" }), run that migration.ts with the `node` command `migration plan` prints, and apply it with `{bin} db migrate`.',
    );
  });

  it('under db update, plans the change from the database contract with migration plan', () => {
    expect(dbUpdateKeepDataEditAdvice(PROJECT, 'sha256:0123')('Status.ARCHIVED', edits)).toBe(
      'db update cannot keep that data. To keep it, plan the change with `{bin} migration plan --from sha256:0123 --delete Status.ARCHIVED`, in the migration.ts it writes replace this.removeStoredValue({ column: "status" }) with this.replaceStoredValue({ column: "status" }), and replace this.removeStoredValue({ column: "tags" }) with this.replaceStoredValue({ column: "tags" }), run that migration.ts with the `node` command `migration plan` prints, and apply it with `{bin} db migrate`.',
    );
  });

  it('under db update with no migration at the database contract, says it cannot keep the data', () => {
    expect(dbUpdateKeepDataEditAdvice(PROJECT, undefined)('Status.ARCHIVED', edits)).toBe(
      'db update cannot keep that data, and no migration ends at the contract the database is at, so `{bin} migration plan` cannot plan the change from it.',
    );
  });
});
