import type { Contract } from '@internal/contract/types';
import { type SqlControlTargetDescriptor, sqlTypeLookupsOf } from '@internal/family-sql/control';
import type { ControlTargetInstance } from '@internal/framework-components/control';
import { SqlStorage } from '@internal/sql-contract/types';
import { relationalNodeEntityKind, relationalNodeGranularity } from '@internal/sql-schema-ir/types';
import { MARKER_TABLE_NAME } from '../control-tables';
import { mysqlTargetDescriptorMeta } from '../descriptor-meta';
import { mysqlError, mysqlNotYetSupported } from '../errors';
import { MysqlContractSerializer } from '../mysql-contract-serializer';
import { diffMysqlSchema, mysqlContractToSchema } from './diff-database-schema';
import { MysqlSchemaVerifier } from './mysql-schema-verifier';
import type { MysqlPlanTargetDetails } from './planner-target-details';

function isSqlContract(contract: Contract | null): contract is Contract<SqlStorage> | null {
  return contract === null || contract.storage instanceof SqlStorage;
}

const mysqlControlTargetDescriptor: SqlControlTargetDescriptor<'mysql', MysqlPlanTargetDetails> = {
  ...mysqlTargetDescriptorMeta,
  contractSerializer: new MysqlContractSerializer(),
  schemaVerifier: new MysqlSchemaVerifier(),
  diffSchema: diffMysqlSchema,
  classifySubjectGranularity: relationalNodeGranularity,
  classifyEntityKind: relationalNodeEntityKind,
  migrations: {
    applyAtomicity: 'per-space',
    markerLocation: MARKER_TABLE_NAME,
    createPlanner() {
      throw mysqlNotYetSupported('Planning migrations');
    },
    createRunner() {
      throw mysqlNotYetSupported('Running migrations');
    },
    contractToSchema(contract, frameworkComponents) {
      if (!isSqlContract(contract)) {
        throw mysqlError(
          'CONTRACT.TARGET_MISMATCH',
          'The MySQL target received a contract that is not a SQL contract.',
        );
      }
      return mysqlContractToSchema(contract, sqlTypeLookupsOf(frameworkComponents));
    },
  },
  create(): ControlTargetInstance<'sql', 'mysql'> {
    return { familyId: 'sql', targetId: 'mysql' };
  },
  createPlanner() {
    throw mysqlNotYetSupported('Planning migrations');
  },
  createRunner() {
    throw mysqlNotYetSupported('Running migrations');
  },
};

export default mysqlControlTargetDescriptor;
