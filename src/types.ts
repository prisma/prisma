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
  export type ApplyMigration = {
    migrationId: string
    steps: DatamodelStep[]
    force: boolean
  }
  export type CalculateDatamodel = {
    steps: DatamodelStep[]
  }
  export type InferMigrationSteps = {
    migrationId: string
    dataModel: string
    assumeToBeApplied: DatamodelStep[]
  }
  export type MigrationProgress = {
    migrationId: string
  }
  export type CalculateDatabaseSteps = {
    assumeToBeApplied: DatamodelStep[]
    stepsToApply: DatamodelStep[]
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
    Success = 'Success',
    InProgress = 'InProgress',
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
  export type StoredMigration = {
    id: string
    steps: DatamodelStep[]
    status: MigrationStatus
  }
  export type CalculateDatamodel = {
    datamodel: string
  }
  export type ListMigrations = StoredMigration[]
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

export type Migration = {
  id: string
  steps: any[]
  datamodel: string
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

export type DatabaseStep =
  | RawSqlStep
  | DropTableStep
  | RenameTableStep
  | CreateTableStep
