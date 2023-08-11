import { DMMFHelper } from '../dmmf'
import * as ts from '../ts-builders'
import { extArgsParam, getLegacyModelArgName, getModelArgName } from '../utils'

export class DefaultArgsAliases {
  private existingArgTypes = new Set<string>()

  registerArgName(name: string) {
    this.existingArgTypes.add(name)
  }

  generateAliases(dmmf: DMMFHelper) {
    const aliases: string[] = []
    for (const modelName of Object.keys(dmmf.typeAndModelMap)) {
      const legacyName = getLegacyModelArgName(modelName)
      if (this.existingArgTypes.has(legacyName)) {
        // alias to and old name is not created if there
        // is already existing arg type with the same name
        continue
      }

      const newName = getModelArgName(modelName)

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
