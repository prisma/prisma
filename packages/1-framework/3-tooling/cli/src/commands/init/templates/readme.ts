import { formatRunScriptCommand, type PackageManager } from '../detect-package-manager';
import type { TargetId } from './code-templates';
import { renderTemplate } from './render';

const sharedVariables = ['projectName', 'contractPath', 'runDev', 'runContractEmit'] as const;

export const postgresVariables = [
  ...sharedVariables,
  'runDbInit',
  'runDbUpdate',
  'runMigrationPlan',
  'runMigrate',
  'runDbSeed',
] as const;

export const mongoVariables = [
  ...sharedVariables,
  'runDbUp',
  'runDbDown',
  'runDbReset',
  'runMigrationPlan',
  'runMigrate',
  'runDbSeed',
] as const;

type PostgresVars = Record<(typeof postgresVariables)[number], string>;
type MongoVars = Record<(typeof mongoVariables)[number], string>;

export function minimalProjectReadmeMd(
  target: TargetId,
  schemaPath: string,
  projectName: string,
  pm: PackageManager,
): string {
  const run = (script: string): string => formatRunScriptCommand(pm, script);
  const shared = {
    projectName,
    contractPath: schemaPath,
    runDev: run('dev'),
    runContractEmit: run('contract:emit'),
    runMigrationPlan: run('migration:plan'),
    runMigrate: run('migrate'),
    runDbSeed: run('db:seed'),
  };

  if (target === 'mongo') {
    const vars: MongoVars = {
      ...shared,
      runDbUp: run('db:up'),
      runDbDown: run('db:down'),
      runDbReset: run('db:reset'),
    };
    return renderTemplate('readme-mongo.md', mongoVariables, vars);
  }

  const vars: PostgresVars = {
    ...shared,
    runDbInit: run('db:init'),
    runDbUpdate: run('db:update'),
  };
  return renderTemplate('readme-postgres.md', postgresVariables, vars);
}
