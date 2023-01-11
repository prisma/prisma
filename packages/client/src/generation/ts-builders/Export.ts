import { AnyDeclarationBuilder } from './AnyDeclarationBuilder'
import { BasicBuilder } from './BasicBuilder'
import { Writer } from './Writer'

export class Export implements BasicBuilder {
  constructor(private declaration: AnyDeclarationBuilder) {}
  write(writer: Writer): void {
    writer.write('export ').write(this.declaration)
  }
}

export function moduleExport(declaration: AnyDeclarationBuilder) {
  return new Export(declaration)
}
