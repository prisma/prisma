import { DatamodelEnum, SchemaEnum } from './dmmf'

export function datamodelEnumToSchemaEnum(datamodelEnum: DatamodelEnum): SchemaEnum {
  return {
    name: datamodelEnum.name,
    values: datamodelEnum.values.map((v) => v.name),
  }
}
