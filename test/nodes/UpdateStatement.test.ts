import { describe, expect, it } from 'bun:test';
import type { UpdateStatementNode } from '../../src';
import Arel from '../../src';

/** Builds an UpdateStatement, then stamps it with primitive fixture props for hash-equality tests. */
const makeStatement = (props: Record<string, unknown> = {}): UpdateStatementNode & Record<string, unknown> => {
  const stmt = new Arel.Nodes.UpdateStatement();
  Object.assign(stmt, props);
  return stmt as UpdateStatementNode & Record<string, unknown>;
};

describe('UpdateStatement', () => {
  describe('clone', () => {
    it('clones wheres and values', () => {
      const statement = makeStatement({ wheres: ['a', 'b', 'c'], values: ['x', 'y', 'z'] });

      expect(statement.wheres).toEqual(['a', 'b', 'c'] as unknown as typeof statement.wheres);
      expect(statement.values).toEqual(['x', 'y', 'z'] as unknown as typeof statement.values);
    });
  });

  describe('equality', () => {
    it('is equal with equal ivars', () => {
      const fixture = {
        relation: 'zomg',
        wheres: [2],
        values: [false],
        orders: ['x', 'y', 'z'],
        limit: 42,
        key: 'zomg',
        groups: ['foo'],
        havings: [],
      };
      const statement1 = makeStatement(fixture);
      const statement2 = makeStatement(fixture);

      expect(statement1.isEqual(statement2)).toBe(true);
    });

    it('is not equal with different ivars', () => {
      const statement1 = makeStatement({
        relation: 'zomg',
        wheres: [2],
        values: [false],
        orders: ['x', 'y', 'z'],
        limit: 42,
        key: 'zomg',
      });
      const statement2 = makeStatement({
        relation: 'zomg',
        wheres: [2],
        values: [false],
        orders: ['x', 'y', 'z'],
        limit: 42,
        key: 'wth',
      });

      expect(statement1.isEqual(statement2)).toBe(false);
    });
  });
});
