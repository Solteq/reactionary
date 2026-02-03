import type z from "zod";

export type StripIndexSignature<T> =
  T extends (infer U)[] ? StripIndexSignature<U>[] :
  T extends readonly (infer U)[] ? readonly StripIndexSignature<U>[] :
  T extends Set<infer U> ? Set<StripIndexSignature<U>> :
  T extends Map<infer K, infer V> ? Map<StripIndexSignature<K>, StripIndexSignature<V>> :
  T extends Promise<infer U> ? Promise<StripIndexSignature<U>> :
  T extends object ? {
    [K in keyof T as K extends string
      ? string extends K
        ? never
        : K
      : K
    ]: StripIndexSignature<T[K]>
  } :
  T;

export type AvoidSimplification<T> = T & { _?: never }

export type InferType<T extends z.ZodTypeAny> = AvoidSimplification<StripIndexSignature<z.infer<T>>>;