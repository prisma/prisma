import { Writer } from './Writer'

export interface BasicBuilder {
  write(writer: Writer): void
}
