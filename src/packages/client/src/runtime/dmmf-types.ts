import { DMMF } from "@prisma/generator-helper";

export interface BaseField {
  name: string
  type: string | DMMF.Enum | DMMF.OutputType | DMMF.SchemaArg
  isList: boolean
  isRequired: boolean
}

export { DMMF }
