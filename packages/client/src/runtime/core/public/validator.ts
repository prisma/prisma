import { Args, Operation } from '../types/Public'
import { Exact } from '../types/Utils'

export function validator<V>(): <S>(select: Exact<S, V>) => S
export function validator<C, M extends Exclude<keyof C, `$${string}`>, O extends keyof C[M] & Operation>(
  client: C,
  model: M,
  operation: O,
): <S>(select: Exact<S, Args<C[M], O>>) => S
export function validator<
  C,
  M extends Exclude<keyof C, `$${string}`>,
  O extends keyof C[M] & Operation,
  P extends keyof Args<C[M], O>,
>(client: C, model: M, operation: O, prop: P): <S>(select: Exact<S, Args<C[M], O>[P]>) => S
export function validator(..._args: any[]) {
  return (args: any) => args
}
