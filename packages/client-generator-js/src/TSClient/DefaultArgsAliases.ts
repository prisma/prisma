export class DefaultArgsAliases {
  private existingArgTypes = new Set<string>()

  registerArgName(name: string) {
    this.existingArgTypes.add(name)
  }
}
