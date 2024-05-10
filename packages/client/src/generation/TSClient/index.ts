import 'flat-map-polyfill' // unfortunately needed as it's not properly polyfilled in TypeScript

export { Enum } from './Enum'
export { BrowserJS, JS, TS } from './Generable'
export { InputField, InputType } from './Input'
export { Model, ModelDelegate } from './Model'
export { TSClient } from './TSClient'
