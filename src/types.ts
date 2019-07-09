import { GeneratorDefinition } from '@prisma/cli'

export type DatamodelStep = CreateModelStep | CreateFieldStep

export type CreateModelStep = {
  stepType: 'CreateModel'
  name: string
  embedded: boolean
}

export type CreateFieldStep = {
  stepType: 'CreateField'
  model: string
  name: string
  type: FieldType
  arity: FieldArity
  isUnique: boolean
}

export enum PrimitiveType {
  String = 'String',
  Int = 'Int',
  Float = 'Float',
  Boolean = 'Boolean',
}

export enum FieldArity {
  required = 'required',
  list = 'list',
  optional = 'optional',
}

export type FieldType = BaseFieldType | RelationFieldType

export type BaseFieldType = {
  Base: PrimitiveType
}

export type RelationFieldType = {
  Relation: {
    to: string
    to_field: string | null
    name: string | null
    on_delete: string
  }
}

export namespace EngineArgs {
  /**
   * These RPCs need a sourceConfig, therefore a db connection to function
   */
  export type ApplyMigration = {
    migrationId: string
    steps: DatamodelStep[]
    force: boolean
    sourceConfig: string
  }
  export type InferMigrationSteps = {
    migrationId: string
    datamodel: string
    assumeToBeApplied: DatamodelStep[]
    sourceConfig: string
  }
  export type MigrationProgress = {
    migrationId: string
    sourceConfig: string
  }
  export type CalculateDatabaseSteps = {
    assumeToBeApplied: DatamodelStep[]
    stepsToApply: DatamodelStep[]
    sourceConfig: string
  }
  /**
   * These don't
   */
  export type DmmfToDml = {
    dmmf: any // TODO type this
    config: any
  }
  export type CalculateDatamodel = {
    steps: DatamodelStep[]
  }
  export type GetConfig = {
    datamodel: string
  }
  export type UnapplyMigration = {
    sourceConfig: string
  }
  export type ListMigrations = {
    sourceConfig: string
  }
}

export namespace EngineResults {
  export type InferMigrationSteps = {
    datamodelSteps: DatamodelStep[]
    databaseSteps: any[]
    warnings: any[]
    errors: any[]
    generalErrors: any[]
  }
  export enum MigrationStatus {
    MigrationSuccess = 'MigrationSuccess',
    MigrationInProgress = 'MigrationInProgress',
    MigrationFailure = 'MigrationFailure',
    Pending = 'Pending',
    RollingBack = 'RollingBack',
    RollbackSuccess = 'RollbackSuccess',
    RollbackFailure = 'RollbackFailure',
  }
  export type MigrationProgress = {
    status: MigrationStatus
    steps: number
    applied: number
    rolledBack: number
    errors: any[]
    startedAt: string
    finishedAt: string
  }
  export type ApplyMigration = {
    datamodelSteps: DatamodelStep[]
    databaseSteps: DatabaseStep[]
    warnings: any[]
    errors: any[]
    generalErrors: any[]
  }
  export type UnapplyMigration = {
    rolledBack: DatamodelStep[]
    active: DatamodelStep[]
    errors: any[]
  }
  export type StoredMigration = {
    id: string
    datamodelSteps: DatamodelStep[]
    databaseSteps: DatabaseStep[]
    status: MigrationStatus
    datamodel: string
  }
  export type CalculateDatamodel = {
    datamodel: string
  }
  export type ListMigrations = StoredMigration[]
  export type DmmfToDml = {
    datamodel: string
  }
}

export type ConnectorType = 'mysql' | 'mongo' | 'sqlite' | 'postgresql'

export type ConfigMetaFormat = { datasources: DataSource[]; generators: GeneratorConfig[] }

export type GeneratorConfig = {
  name: string
  output: string | null
  provider: string
  config: Dictionary<string>
}

export type DataSource = {
  name: string
  connectorType: ConnectorType
  url: string
  config: {}
}

export interface FileMap {
  [fileName: string]: string
}

export type LockFile = {
  localMigrations: string[]
  remoteMigrations: string[]
  localBranch?: string
  remoteBranch?: string
  // TODO: add the conflicts here
}

export type Dictionary<T> = {
  [key: string]: T
}

export interface LocalMigration extends Migration {
  afterFilePath?: string
  beforeFilePath?: string
}

export interface Migration {
  id: string
  datamodelSteps: DatamodelStep[]
  databaseSteps?: DatabaseStep[]
  datamodel: string
}

export interface LocalMigrationWithDatabaseSteps extends LocalMigration {
  databaseSteps: DatabaseStep[]
}

export type RawSqlStep = {
  RawSql: string
  raw: string
}

export type DropTableStep = {
  raw: string
  DropTable: {
    name: string
  }
}

export type RenameTableStep = {
  raw: string
  RenameTable: {
    name: string
    new_name: string
  }
}

export type CreateTableStep = {
  raw: string
  CreateTable: {
    name: string
    columns: CreateColumn[]
    primary_columns: string[]
  }
}

export type CreateColumn = {
  raw: string
  name: string
  tpe: string
  required: boolean
  foreign_key: null | {
    table: string
    column: string
  }
}

export type DatabaseStep = RawSqlStep | DropTableStep | RenameTableStep | CreateTableStep
