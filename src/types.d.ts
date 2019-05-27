export type MigrationStep = CreateModelStep | CreateFieldStep

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

export namespace EngineArgs {
  export type ApplyMigration = {
    migrationId: string
    steps: MigrationStep[]
    force: boolean
  }
  export type InferMigrationSteps = {
    migrationId: string
    datamodel: string
  }
  export type MigrationProgress = {
    migrationId: string
  }
}
