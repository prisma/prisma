import type { Param } from '../types/exported/Param'

export class ParamImpl<Type, Name extends string> implements Param<Type, Name> {
  constructor(public readonly name: Name) {}
}

export function isParam(value: unknown): value is Param<unknown, string> {
  return value instanceof ParamImpl
}

export function createParam(name: string): Param<unknown, string> {
  return new ParamImpl(name)
}
