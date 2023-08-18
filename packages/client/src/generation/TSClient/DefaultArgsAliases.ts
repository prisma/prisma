import * as ts from '../ts-builders'
import { extArgsParam } from '../utils'

type AliasDefinition = {
  newName: string
  legacyName: string
}

export class DefaultArgsAliases {
  private existingArgTypes = new Set<string>()
  private possibleAliases: AliasDefinition[] = []

  addPossibleAlias(newName: string, legacyName: string) {
    this.possibleAliases.push({ newName, legacyName })
  }

  registerArgName(name: string) {
    this.existingArgTypes.add(name)
  }

  generateAliases() {
    const aliases: string[] = []
    for (const { newName, legacyName } of this.possibleAliases) {
      if (this.existingArgTypes.has(legacyName)) {
        // alias to and old name is not created if there
        // is already existing arg type with the same name
        continue
      }

      aliases.push(
        ts.stringify(
          ts
            .moduleExport(
              ts
                .typeDeclaration(legacyName, ts.namedType(newName).addGenericArgument(extArgsParam.toArgument()))
                .addGenericParameter(extArgsParam),
            )
            .setDocComment(ts.docComment(`@deprecated Use ${newName} instead`)),
          { indentLevel: 1 },
        ),
      )
    }

    return aliases.join('\n')
  }
}
