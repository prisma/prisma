import { TypeBuilder } from './TypeBuilder'
import { Writer } from './Writer'

export class IntersectionType<MemberType extends TypeBuilder = TypeBuilder> extends TypeBuilder {
  needsParenthesisWhenIndexed = true
  needsParenthesisInKeyof = true
  readonly members: MemberType[]

  constructor(firstType: MemberType) {
    super()
    this.members = [firstType]
  }

  addType(type: MemberType) {
    this.members.push(type)
    return this
  }

  addTypes(types: MemberType[]) {
    for (const type of types) {
      this.addType(type)
    }
    return this
  }

  write(writer: Writer): void {
    writer.writeJoined(' & ', this.members, (member, writer) => {
      if (member.needsParenthesisInIntersection) {
        writer.write('(').write(member).write(')')
      } else {
        writer.write(member)
      }
    })
  }

  mapTypes<NewMemberType extends TypeBuilder>(
    callback: (type: MemberType) => NewMemberType,
  ): IntersectionType<NewMemberType> {
    return intersectionType(this.members.map((m) => callback(m)))
  }
}

export function intersectionType<MemberType extends TypeBuilder = TypeBuilder>(types: MemberType[] | MemberType) {
  if (Array.isArray(types)) {
    if (types.length === 0) {
      throw new TypeError('Intersection types array can not be empty')
    }
    const intersection = new IntersectionType(types[0])
    for (let i = 1; i < types.length; i++) {
      intersection.addType(types[i])
    }
    return intersection
  }
  return new IntersectionType(types)
}
