export type DatamodelStep = CreateModelStep | CreateFieldStep

export interface CreateModelStep {
  stepType: 'CreateModel'
  name: string
  embedded: boolean
}

export interface CreateFieldStep {
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

export interface BaseFieldType {
  Base: PrimitiveType
}

export interface RelationFieldType {
  Relation: {
    to: string
    to_field: string | null
    name: string | null
    on_delete: string
  }
}

export interface UnexecutableMigration {
  description: string
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace EngineArgs {
  /**
   * These RPCs need a sourceConfig, therefore a db connection to function
   */
  export interface SchemaPush {
    schema: string
    force: boolean
  }
  export interface ApplyMigration {
    migrationId: string
    steps: DatamodelStep[]
    force: boolean
    sourceConfig: string
  }
  export interface InferMigrationSteps {
    migrationId: string
    datamodel: string
    assumeToBeApplied: DatamodelStep[]
    sourceConfig: string
  }
  export interface MigrationProgress {
    migrationId: string
    sourceConfig: string
  }
  export interface CalculateDatabaseSteps {
    assumeToBeApplied: DatamodelStep[]
    stepsToApply: DatamodelStep[]
    sourceConfig: string
  }
  /**
   * These don't
   */
  export interface CalculateDatamodel {
    steps: DatamodelStep[]
  }
  export interface UnapplyMigration {
    sourceConfig: string
  }
  export interface ListMigrations {
    sourceConfig: string
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace EngineResults {
  export interface SchemaPush {
    executedSteps: number
    warnings: string[]
    unexecutable: string[]
  }
  export interface InferMigrationSteps {
    datamodelSteps: DatamodelStep[]
    databaseSteps: any[]
    warnings: any[]
    errors: any[]
    generalErrors: any[]
    unexecutableMigrations: UnexecutableMigration[]
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
  export interface MigrationProgress {
    status: MigrationStatus
    steps: number
    applied: number
    rolledBack: number
    errors: any[]
    startedAt: string
    finishedAt: string
  }
  export interface ApplyMigration {
    datamodelSteps: DatamodelStep[]
    databaseSteps: DatabaseSteps[]
    warnings: Warning[]
    errors: any[]
    generalErrors: any[]
    unexecutableMigrations: UnexecutableMigration[]
  }

  export interface Warning {
    description: string
  }

  export interface UnapplyMigration {
    rolledBack: DatamodelStep[]
    active: DatamodelStep[]
    errors: any[]
  }
  export interface StoredMigration {
    id: string
    datamodelSteps: DatamodelStep[]
    databaseSteps: DatabaseSteps[]
    status: MigrationStatus
    datamodel: string
  }
  export interface CalculateDatamodel {
    datamodel: string
  }
  export type ListMigrations = StoredMigration[]
}

export type ConnectorType = 'mysql' | 'mongo' | 'sqlite' | 'postgresql'

export interface GeneratorConfig {
  name: string
  output: string | null
  provider: string
  config: Dictionary<string>
}

export interface FileMap {
  [fileName: string]: string
}

export interface LockFile {
  localMigrations: string[]
  remoteMigrations: string[]
  localBranch?: string
  remoteBranch?: string
  // TODO: add the conflicts here
}

export interface Dictionary<T> {
  [key: string]: T
}

export interface LocalMigration extends Migration {
  afterFilePath?: string
  beforeFilePath?: string
}

export interface Migration {
  id: string
  datamodelSteps: DatamodelStep[]
  databaseSteps?: DatabaseSteps[]
  datamodel: string
}

export interface DatabaseSteps {
  step: DatabaseStep
  raw: string
}

export interface LocalMigrationWithDatabaseSteps extends LocalMigration {
  databaseSteps: DatabaseSteps[]
  warnings: EngineResults.Warning[]
  unexecutableMigrations: UnexecutableMigration[]
}

export interface RawSqlStep {
  RawSql: string
}

export interface DropTableStep {
  DropTable: {
    name: string
  }
}

export interface RenameTableStep {
  RenameTable: {
    name: string
    new_name: string
  }
}

export interface CreateTableStep {
  CreateTable: {
    name: string
    columns: CreateColumn[]
    primary_columns: string[]
  }
}

export interface CreateColumn {
  name: string
  tpe: string
  required: boolean
  foreign_key: null | {
    table: string
    column: string
  }
}

export type DatabaseStep =
  | RawSqlStep
  | DropTableStep
  | RenameTableStep
  | CreateTableStep
