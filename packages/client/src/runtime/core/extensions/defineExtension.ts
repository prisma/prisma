import { ExtendsInput } from './$extends'

export function defineExtension<Input extends ExtendsInput>(ext: Input): Input {
  return ext
}
