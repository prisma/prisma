import type {
  MigrationPlanOperation,
  OperationPreview,
} from '@internal/framework-components/control';
import type {
  CollModCommand,
  CreateCollectionCommand,
  CreateIndexCommand,
  DropCollectionCommand,
  DropIndexCommand,
  MongoDdlCommandVisitor,
  MongoIndexKey,
} from '@internal/mongo-query-ast/control';

function formatKeySpec(keys: ReadonlyArray<MongoIndexKey>): string {
  const entries = keys.map((k) => `${JSON.stringify(k.field)}: ${JSON.stringify(k.direction)}`);
  return `{ ${entries.join(', ')} }`;
}

const COMMAND_META_KEYS = new Set(['kind', 'collection', 'keys']);

function formatOptionEntries(cmd: object): string | undefined {
  const parts = Object.entries(cmd)
    .filter(([key, value]) => !COMMAND_META_KEYS.has(key) && value !== undefined)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
  if (parts.length === 0) return undefined;
  return `{ ${parts.join(', ')} }`;
}

function formatOptions(cmd: CreateIndexCommand): string | undefined {
  return formatOptionEntries(cmd);
}

function formatCreateCollectionOptions(cmd: CreateCollectionCommand): string | undefined {
  return formatOptionEntries(cmd);
}

class MongoDdlCommandFormatter implements MongoDdlCommandVisitor<string> {
  createIndex(cmd: CreateIndexCommand): string {
    const keySpec = formatKeySpec(cmd.keys);
    const opts = formatOptions(cmd);
    return opts
      ? `db.${cmd.collection}.createIndex(${keySpec}, ${opts})`
      : `db.${cmd.collection}.createIndex(${keySpec})`;
  }

  dropIndex(cmd: DropIndexCommand): string {
    return `db.${cmd.collection}.dropIndex(${JSON.stringify(cmd.name)})`;
  }

  createCollection(cmd: CreateCollectionCommand): string {
    const opts = formatCreateCollectionOptions(cmd);
    return opts
      ? `db.createCollection(${JSON.stringify(cmd.collection)}, ${opts})`
      : `db.createCollection(${JSON.stringify(cmd.collection)})`;
  }

  dropCollection(cmd: DropCollectionCommand): string {
    return `db.${cmd.collection}.drop()`;
  }

  collMod(cmd: CollModCommand): string {
    const parts: string[] = [`collMod: ${JSON.stringify(cmd.collection)}`];
    for (const [key, value] of Object.entries(cmd)) {
      if (!COMMAND_META_KEYS.has(key) && value !== undefined)
        parts.push(`${key}: ${JSON.stringify(value)}`);
    }
    return `db.runCommand({ ${parts.join(', ')} })`;
  }
}

const formatter = new MongoDdlCommandFormatter();

interface MongoExecuteStep {
  readonly command: { readonly accept: <R>(visitor: MongoDdlCommandVisitor<R>) => R };
}

export function formatMongoOperations(operations: readonly MigrationPlanOperation[]): string[] {
  const statements: string[] = [];
  for (const operation of operations) {
    const candidate = operation as unknown as Record<string, unknown>;
    if (!('execute' in candidate) || !Array.isArray(candidate['execute'])) {
      continue;
    }
    for (const step of candidate['execute'] as MongoExecuteStep[]) {
      if (step.command && typeof step.command.accept === 'function') {
        statements.push(step.command.accept(formatter));
      }
    }
  }
  return statements;
}

/**
 * Wraps `formatMongoOperations` into the family-agnostic
 * `OperationPreview` shape. Each statement carries
 * `language: 'mongodb-shell'`. Mirrors `sqlOperationsToPreview`.
 */
export function mongoOperationsToPreview(
  operations: readonly MigrationPlanOperation[],
): OperationPreview {
  return {
    statements: formatMongoOperations(operations).map((text) => ({
      text,
      language: 'mongodb-shell',
    })),
  };
}
