import { Writer } from './Writer'

export interface BasicBuilder<ContextType = undefined> {
  write(writer: Writer<ContextType>): void
}
