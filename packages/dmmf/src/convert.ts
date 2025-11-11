import { DatamodelEnum, DatamodelSchemaEnum, SchemaEnum } from './dmmf'

export function datamodelEnumToSchemaEnum(datamodelEnum: DatamodelEnum): SchemaEnum {
  return {
    name: datamodelEnum.name,
    data: datamodelEnum.values.map((v) => ({
      key: v.name,
      value: v.dbName ?? v.name,
    })),
  }
}

export function datamodelSchemaEnumToSchemaEnum(datamodelSchemaEnum: DatamodelSchemaEnum): SchemaEnum {
  return {
    name: datamodelSchemaEnum.name,
    data: datamodelSchemaEnum.values.map((v) => ({
      key: v,
      value: v,
    })),
  }
}
