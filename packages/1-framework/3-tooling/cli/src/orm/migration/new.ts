import { ifDefined } from '@internal/utils/defined';
import type { Block, Presentations } from '@prisma/cli-engine';
import { defineCommand, flag } from '@prisma/cli-engine';
import type { NextAction } from '@prisma/cli-engine/protocol';
import { notOk, ok } from '@prisma/cli-engine/protocol';
import { join } from 'pathe';
import type { MigrationNewResult } from '../../control-api/operations/migration-new';
import { executeMigrationNewCommand } from '../../control-api/operations/migration-new';
import { runCommandAction } from '../../utils/next-actions';
import { ormConfigSection } from '../config-section';
import { normalizeError } from '../normalize-error';
import { appMigrationsDirFor, contractPathFor, displayPath, projectConfigPathFor } from './paths';

function newPresentations(inputs: {
  readonly document: MigrationNewResult;
  readonly contractPath: string;
  readonly appMigrationsRelative: string;
}): Presentations {
  const { document } = inputs;
  const migrationTs = join(document.dir, 'migration.ts');
  return {
    human: (): readonly Block[] => [
      {
        kind: 'fields',
        rail: true,
        rows: [
          { label: 'contract', value: inputs.contractPath },
          { label: 'migrations', value: inputs.appMigrationsRelative },
        ],
      },
      { kind: 'summary', status: 'ok', text: document.summary },
      {
        kind: 'fields',
        rows: [
          {
            label: 'from',
            value:
              document.from === null
                ? [{ text: '(baseline)', tone: 'muted' }]
                : [{ text: document.from, tone: 'identifier' }],
          },
          { label: 'to', value: [{ text: document.to, tone: 'identifier' }] },
        ],
      },
    ],
    json: () => document,
    next: (): readonly NextAction[] => [
      { kind: 'edit-file', label: `Write the migration body in ${migrationTs}` },
      runCommandAction(
        'Run it to self-emit ops.json and attest the package',
        `node "${migrationTs}"`,
      ),
    ],
  };
}

export const migrationNewCommand = defineCommand({
  help: {
    summary: 'Scaffold a new migration for manual authoring',
    description:
      'Creates a migration package with a migration.ts file for manual authoring.\n' +
      'Write the migration body in migration.ts, then run the file with Node\n' +
      '(`node migration.ts`) to self-emit ops.json and attest the package.\n' +
      'Offline — does not consult the database.',
    examples: [
      'migration new --name split-name',
      'migration new --name custom-fk --from abc123',
      'migration new --json',
    ],
  },
  args: {
    flags: {
      name: flag.string({ brief: 'Migration name (used in directory name)', placeholder: 'slug' }),
      from: flag.string({
        brief: 'Starting contract hash (default: latest migration target)',
        placeholder: 'hash',
      }),
    },
  },
  needs: { config: ormConfigSection },
  handler: async (args, ctx) => {
    try {
      const scaffolded = await executeMigrationNewCommand({
        config: ctx.config,
        cwd: ctx.cwd,
        configPath: projectConfigPathFor(ctx.cwd),
        ...ifDefined('name', args.flags.name),
        ...ifDefined('from', args.flags.from),
      });
      if (!scaffolded.ok) {
        return notOk(normalizeError(scaffolded.failure));
      }

      const contractPath = contractPathFor(ctx.config, ctx.cwd);
      return ok(
        ctx.present(
          { data: scaffolded.value },
          newPresentations({
            document: scaffolded.value,
            contractPath:
              contractPath === undefined ? '(unset)' : displayPath(contractPath, ctx.cwd),
            appMigrationsRelative: displayPath(appMigrationsDirFor(ctx.config, ctx.cwd), ctx.cwd),
          }),
        ),
      );
    } catch (error) {
      return notOk(normalizeError(error));
    }
  },
});
