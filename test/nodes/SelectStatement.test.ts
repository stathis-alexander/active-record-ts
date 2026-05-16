import { describe, expect, it } from 'bun:test';
import type { SelectStatementNode } from '../../src';
import Arel from '../../src';

/**
 * Builds a SelectStatement and stamps it with arbitrary primitive ivars
 * — used by the equality tests below to verify the hash-based `isEqual`
 * across structurally-different instances. The returned shape is the real
 * node plus a permissive property-bag so the test can assign primitives
 * without TypeScript complaining about the strict AST field types.
 */
const makeStatement = (
  relation: unknown,
  props: Record<string, unknown> = {},
): SelectStatementNode & Record<string, unknown> => {
  const stmt = new Arel.Nodes.SelectStatement(relation as ConstructorParameters<typeof Arel.Nodes.SelectStatement>[0]);
  Object.assign(stmt, props);
  return stmt as SelectStatementNode & Record<string, unknown>;
};

describe('SelectStatement', () => {
  describe('cores', () => {
    it('has cores array', () => {
      const statement = makeStatement(['a', 'b', 'c']);
      expect(statement.cores).toBeInstanceOf(Array);
      expect(statement.cores.length).toBe(1);
    });
  });

  describe('equality', () => {
    it('is equal with equal ivars', () => {
      const fixture = { offset: 1, limit: 2, lock: false, orders: ['x', 'y', 'z'], with: 'zomg' };
      const statement1 = makeStatement(['a', 'b', 'c'], fixture);
      const statement2 = makeStatement(['a', 'b', 'c'], fixture);

      expect(statement1.isEqual(statement2)).toBe(true);
    });

    it('is not equal with different ivars', () => {
      const statement1 = makeStatement(['a', 'b', 'c'], {
        offset: 1,
        limit: 2,
        lock: false,
        orders: ['x', 'y', 'z'],
        with: 'zomg',
      });
      const statement2 = makeStatement(['a', 'b', 'c'], {
        offset: 1,
        limit: 2,
        lock: false,
        orders: ['x', 'y', 'z'],
        with: 'wth',
      });

      expect(statement1.isEqual(statement2)).toBe(false);
    });
  });
});
