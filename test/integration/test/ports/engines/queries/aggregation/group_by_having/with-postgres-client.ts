import postgresAdapterControl from '@internal/adapter-postgres/control';
import type { Contract } from '@internal/contract/types';
import postgresDriverControl from '@internal/driver-postgres/control';
import sqlFamilyControl, { INIT_ADDITIVE_POLICY } from '@internal/family-sql/control';
import { APP_SPACE_ID, createControlStack } from '@internal/framework-components/control';
import { buildFabricatedMigrationEdge } from '@internal/migration-tools/aggregate';
import postgres from '@internal/postgres/runtime';
import type { SqlStorage } from '@internal/sql-contract/types';
import postgresTargetControl from '@internal/target-postgres/control';
import { PostgresContractSerializer } from '@internal/target-postgres/runtime';
import { withDevDatabase } from '@repo/test-utils';

const controlStack = createControlStack({
  family: sqlFamilyControl,
  target: postgresTargetControl,
  adapter: postgresAdapterControl,
  driver: postgresDriverControl,
  extensions: [],
});
const controlFamily = sqlFamilyControl.create(controlStack);
const controlAdapter = postgresAdapterControl.create(controlStack);
const frameworkComponents = [
  postgresTargetControl,
  postgresAdapterControl,
  postgresDriverControl,
] as const;
const serializer = new PostgresContractSerializer();

type PostgresClient<TContract extends Contract<SqlStorage>> = ReturnType<
  typeof postgres<TContract>
>;

async function pushContract(connectionString: string, contractJson: unknown): Promise<void> {
  const contract = controlFamily.deserializeContract(contractJson) as Contract<SqlStorage>;
  const driver = await postgresDriverControl.create(connectionString);
  try {
    const schema = await controlFamily.introspect({ driver, contract });
    const planner = postgresTargetControl.createPlanner(controlAdapter);
    const planResult = planner.plan({
      contract,
      schema,
      policy: INIT_ADDITIVE_POLICY,
      fromContract: null,
      frameworkComponents,
      spaceId: APP_SPACE_ID,
      snapshotsImportPath: '../../snapshots',
    });
    if (planResult.kind !== 'success') {
      throw new Error(`Contract push planning failed: ${JSON.stringify(planResult)}`);
    }
    const plan = planResult.plan;
    const runner = postgresTargetControl.createRunner(controlFamily);
    const executeResult = await runner.execute({
      driver,
      perSpaceOptions: [
        {
          space: plan.spaceId ?? APP_SPACE_ID,
          plan,
          migrationEdges: [
            buildFabricatedMigrationEdge({
              currentMarkerStorageHash: plan.origin?.storageHash,
              destinationStorageHash: plan.destination.storageHash,
              operationCount: plan.operations.length,
            }),
          ],
          driver,
          destinationContract: contract,
          policy: INIT_ADDITIVE_POLICY,
          frameworkComponents,
        },
      ],
    });
    if (!executeResult.ok) {
      throw new Error(`Contract push apply failed: ${JSON.stringify(executeResult.failure)}`);
    }
  } finally {
    await driver.close();
  }
}

export async function withPostgresClient<TContract extends Contract<SqlStorage>>(
  contractJson: unknown,
  fn: (client: PostgresClient<TContract>) => Promise<void>,
): Promise<void> {
  const base = serializer.deserializeContract(
    JSON.parse(JSON.stringify(contractJson)),
  ) as TContract;
  const contract = {
    ...base,
    capabilities: { ...base.capabilities, returning: { enabled: true } },
  } as TContract;

  await withDevDatabase(
    async ({ connectionString }) => {
      await pushContract(connectionString, contractJson);
      const client = postgres<TContract>({ contract, url: connectionString, verifyMarker: false });
      const runtime = await client.connect();
      try {
        await fn(client);
      } finally {
        await runtime.close();
      }
    },
    { databaseIdleTimeoutMillis: 30_000 },
  );
}
