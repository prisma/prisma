import 'flat-map-polyfill' // unfortunately needed as it's not properly polyfilled in TypeScript

export { MinimalArgsType, ArgsType } from './Args'
export { Enum } from './Enum'
export { JS, TS } from './Generatable'
export { InputField, InputType } from './Input'
export { Model, ModelDelegate } from './Model'
export { OutputField, OutputType } from './Output'
export { SchemaOutputField, SchemaOutputType } from './SchemaOutput'
export { TSClient } from './TSClient'

