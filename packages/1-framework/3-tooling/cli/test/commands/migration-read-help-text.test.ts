import type { Command } from 'commander';
import { describe, expect, it } from 'vitest';
import { createMigrationCheckCommand } from '../../src/commands/migration-check';
import { createMigrationGraphCommand } from '../../src/commands/migration-graph';
import { createMigrationListCommand } from '../../src/commands/migration-list';
import { createMigrationLogCommand } from '../../src/commands/migration-log';
import { createMigrationShowCommand } from '../../src/commands/migration-show';
import { createMigrationStatusCommand } from '../../src/commands/migration-status';
import {
  getCommandExamples,
  getCommandSeeAlso,
  getLongDescription,
} from '../../src/utils/command-helpers';

const verbs = {
  status: createMigrationStatusCommand,
  list: createMigrationListCommand,
  graph: createMigrationGraphCommand,
  log: createMigrationLogCommand,
  show: createMigrationShowCommand,
  check: createMigrationCheckCommand,
} satisfies Record<string, () => Command>;

const offlineVerbs = ['list', 'graph', 'show', 'check'] as const;
const liveVerbs = ['status', 'log'] as const;

describe('migration read-verb see-also', () => {
  it('check links migration show', () => {
    const seeAlso = getCommandSeeAlso(verbs.check()) ?? [];
    expect(seeAlso.map((ref) => ref.verb)).toContain('migration show');
  });
});

describe('migration read-verb examples', () => {
  it.each(Object.keys(verbs) as (keyof typeof verbs)[])('%s exposes a --json example', (verb) => {
    const examples = getCommandExamples(verbs[verb]()) ?? [];
    expect(examples.some((example) => example.includes('--json'))).toBe(true);
  });
});

describe('migration read-verb offline/live phrasing', () => {
  it.each(offlineVerbs)('%s states it is offline', (verb) => {
    const long = getLongDescription(verbs[verb]()) ?? '';
    expect(long).toContain('Offline — does not consult the database.');
  });

  it.each(liveVerbs)('%s states it needs a database connection', (verb) => {
    const long = getLongDescription(verbs[verb]()) ?? '';
    expect(long).toContain('Requires a database connection.');
  });
});
