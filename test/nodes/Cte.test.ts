import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('Cte', () => {
  describe('equality', () => {
    it('is equal with equal ivars', () => {
      const cte1 = new Arel.Nodes.Cte('foo', 'bar', { materialized: true });
      const cte2 = new Arel.Nodes.Cte('foo', 'bar', { materialized: true });

      expect(cte1.isEqual(cte2)).toBe(true);
    });

    it('is not equal with unequal ivars', () => {
      const cte1 = new Arel.Nodes.Cte('foo', 'bar', { materialized: true });
      const cte2 = new Arel.Nodes.Cte('foo', 'bar');

      expect(cte1.isEqual(cte2)).toBe(false);
    });
  });

  describe('to_cte', () => {
    it('returns self', () => {
      const cte = new Arel.Nodes.Cte('foo', 'bar');

      expect(cte.toCte()).toBe(cte);
    });
  });

  describe('to_table', () => {
    it("returns an Arel::Table using the Cte's name", () => {
      const table = new Arel.Nodes.Cte('foo', 'bar').toTable();

      expect(table).toBeInstanceOf(Arel.Table);
      expect(table.name).toBe('foo');
    });
  });
});
