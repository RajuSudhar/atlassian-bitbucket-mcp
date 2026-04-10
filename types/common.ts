/*
 * Common utility types
 */

/** Branded type for nominal typing (Rust newtype equivalent) */
export type Brand<T, K extends string> = T & { readonly __brand: K };

/** Non-empty array constraint */
export type NonEmptyArray<T> = [T, ...T[]];

/** Deep readonly */
export type DeepReadonly<T> = T extends (infer U)[]
  ? ReadonlyArray<DeepReadonly<U>>
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/** Result type (Rust-style) */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Nullable shorthand */
export type Nullable<T> = T | null;

/** Milliseconds brand */
export type Milliseconds = Brand<number, 'Milliseconds'>;

/** Seconds brand */
export type Seconds = Brand<number, 'Seconds'>;

/** ISO date string */
export type ISODateString = Brand<string, 'ISODateString'>;
