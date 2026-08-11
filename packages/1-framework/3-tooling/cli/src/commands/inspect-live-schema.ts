import { loadConfigForSections, type PrismaNextConfig } from '@internal/config-loader';
import type { AuthoringPslBlockDescriptorNamespace } from '@internal/framework-components/authoring';
import type { CoreSchemaView } from '@internal/framework-components/control';
import type { PslDocumentAst } from '@internal/framework-components/psl-ast';
import { notOk, ok, type Result } from '@internal/utils/result';
import { relative, resolve } from 'pathe';
import { createControlClient } from '../control-api/client';
import {
  CliStructuredError,
  errorDatabaseConnectionRequired,
  errorDriverRequired,
  errorUnexpected,
} from '../utils/cli-errors';
import { maskConnectionUrl, sanitizeErrorMessage } from '../utils/command-helpers';
import { formatStyledHeader } from '../utils/formatters/styled';
import type { CommonCommandOptions, GlobalFlags } from '../utils/global-flags';
import { createProgressAdapter } from '../utils/progress-adapter';
import type { TerminalUI } from '../utils/terminal-ui';

export interface InspectLiveSchemaOptions extends CommonCommandOptions {
  readonly db?: string;
  readonly config?: string;
}

interface InspectLiveSchemaContext {
  readonly commandName: string;
  readonly description: string;
  readonly url: string;
}

type LoadedCliConfig = PrismaNextConfig;

export interface InspectLiveSchemaResult {
  readonly config: LoadedCliConfig;
  readonly schema: unknown;
  readonly schemaView: CoreSchemaView | undefined;
  /**
   * PSL AST inferred from the introspected schema, when the configured family
   * implements `PslContractInferCapable`. `undefined` for families that do not
   * support inference (e.g. Mongo today).
   */
  readonly pslContractAst: PslDocumentAst | undefined;
  /**
   * The assembled PSL block descriptors from the control stack — the full set of
   * extension-contributed top-level block descriptors. Downstream commands pass
   * this through to `printPsl` so contributed-block AST nodes round-trip back to
   * source.
   */
  readonly pslBlockDescriptors: AuthoringPslBlockDescriptorNamespace;
  readonly target: {
    readonly familyId: string;
    readonly id: string;
  };
  readonly meta: {
    readonly configPath?: string;
    readonly dbUrl?: string;
  };
  readonly timings: {
    readonly total: number;
  };
}

export async function inspectLiveSchema(
  options: InspectLiveSchemaOptions,
  flags: GlobalFlags,
  ui: TerminalUI,
  startTime: number,
  context: InspectLiveSchemaContext,
): Promise<Result<InspectLiveSchemaResult, CliStructuredError>> {
  const configResult = await loadConfigForSections(options.config, [
    'family',
    'target',
    'adapter',
    'driver',
    'extensions',
    'db',
  ]);
  if (!configResult.ok) {
    return configResult;
  }
  const config = configResult.value;

  const configPath = options.config
    ? relative(process.cwd(), resolve(options.config))
    : 'prisma-next.config.ts';

  if (!flags.json && !flags.quiet) {
    const details: Array<{ label: string; value: string }> = [
      { label: 'config', value: configPath },
    ];

    if (options.db) {
      details.push({ label: 'database', value: maskConnectionUrl(options.db) });
    } else if (config.db?.connection && typeof config.db.connection === 'string') {
      details.push({ label: 'database', value: maskConnectionUrl(config.db.connection) });
    }

    ui.stderr(
      formatStyledHeader({
        command: context.commandName,
        description: context.description,
        url: context.url,
        details,
        flags,
      }),
    );
  }

  const dbConnection = options.db ?? config.db?.connection;
  if (!dbConnection) {
    return notOk(
      errorDatabaseConnectionRequired({
        why: `Database connection is required for ${context.commandName} (set db.connection in ${configPath}, or pass --db <url>)`,
        commandName: context.commandName,
      }),
    );
  }

  if (!config.driver) {
    return notOk(
      errorDriverRequired({
        why: `Config.driver is required for ${context.commandName}`,
      }),
    );
  }

  const client = createControlClient({
    family: config.family,
    target: config.target,
    adapter: config.adapter,
    driver: config.driver,
    extensions: config.extensions ?? [],
  });
  const onProgress = createProgressAdapter({ ui, flags });

  try {
    const schema = await client.introspect({
      connection: dbConnection,
      onProgress,
    });
    const schemaView = client.toSchemaView(schema);
    const pslContractAst = client.inferPslContract(schema);
    const pslBlockDescriptors = client.getPslBlockDescriptors();

    const dbUrl = typeof dbConnection === 'string' ? maskConnectionUrl(dbConnection) : undefined;

    return ok({
      config,
      schema,
      schemaView,
      pslContractAst,
      pslBlockDescriptors,
      target: {
        familyId: config.family.familyId,
        id: config.target.targetId,
      },
      meta: {
        configPath,
        ...(dbUrl ? { dbUrl } : {}),
      },
      timings: {
        total: Date.now() - startTime,
      },
    });
  } catch (error) {
    if (CliStructuredError.is(error)) {
      return notOk(error);
    }

    const rawMessage = error instanceof Error ? error.message : String(error);
    const safeMessage = sanitizeErrorMessage(
      rawMessage,
      typeof dbConnection === 'string' ? dbConnection : undefined,
    );
    return notOk(
      errorUnexpected(safeMessage, {
        why: `Unexpected error during ${context.commandName}: ${safeMessage}`,
      }),
    );
  } finally {
    await client.close();
  }
}
