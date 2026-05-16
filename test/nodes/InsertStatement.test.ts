import { describe, expect, it } from 'bun:test';
import type { InsertStatementNode } from '../../src';
import Arel from '../../src';

/** Builds an InsertStatement, then stamps it with primitive fixture props for hash-equality tests. */
const makeStatement = (props: Record<string, unknown> = {}): InsertStatementNode & Record<string, unknown> => {
  const stmt = new Arel.Nodes.InsertStatement();
  Object.assign(stmt, props);
  return stmt as InsertStatementNode & Record<string, unknown>;
};

describe('InsertStatement', () => {
  describe('clone', () => {
    it('clones columns and values', () => {
      const statement = makeStatement({ columns: ['a', 'b', 'c'], values: ['x', 'y', 'z'] });

      expect(statement.columns).toEqual(['a', 'b', 'c'] as unknown as typeof statement.columns);
      expect(statement.values).toEqual(['x', 'y', 'z'] as unknown as typeof statement.values);
    });
  });

  describe('equality', () => {
    it('is equal with equal ivars', () => {
      const statement1 = makeStatement({ columns: ['a', 'b', 'c'], values: ['x', 'y', 'z'] });
      const statement2 = makeStatement({ columns: ['a', 'b', 'c'], values: ['x', 'y', 'z'] });

      expect(statement1.isEqual(statement2)).toBe(true);
    });

    it('is not equal with different ivars', () => {
      const statement1 = makeStatement({ columns: ['a', 'b', 'c'], values: ['x', 'y', 'z'] });
      const statement2 = makeStatement({ columns: ['a', 'b', 'c'], values: ['1', '2', '3'] });

      expect(statement1.isEqual(statement2)).toBe(false);
    });
  });
});
