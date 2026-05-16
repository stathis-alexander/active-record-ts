import { expect } from 'bun:test';

/**
 * Assert `value` is an instance of `ctor` and return it narrowed to that type.
 *
 * Use this in tests where a method's return type is a union (e.g. `between` may
 * return `Between | And | LessThanOrEqual | In | ...`). The runtime
 * `toBeInstanceOf` check verifies the variant; the return narrows the type so
 * you can access variant-specific properties without an `as` cast.
 *
 * @example
 * const node = expectInstance(attribute.between(1, 3), Arel.Nodes.Between);
 * expect(node.left).toBe(attribute);
 */
// biome-ignore lint/suspicious/noExplicitAny: standard "any constructor" pattern; constructor signatures vary
export function expectInstance<T>(value: unknown, ctor: new (...args: any[]) => T): T {
  expect(value).toBeInstanceOf(ctor);
  return value as T;
}
