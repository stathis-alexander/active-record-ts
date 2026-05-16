import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('Sum', () => {
  describe('as', () => {
    it('should alias the sum', () => {
      const table = new Arel.Table('users');
      const sql = table.attribute('id').sum().as('foo').toSql();
      expect(sql).toMatch(/SUM.*users.*id.*AS foo/i);
    });
  });

  describe('equality', () => {
    it('is equal with equal ivars', () => {
      const sum1 = new Arel.Nodes.Sum(['foo']);
      const sum2 = new Arel.Nodes.Sum(['foo']);

      expect(sum1.isEqual(sum2)).toBe(true);
    });

    it('is not equal with different ivars', () => {
      const sum1 = new Arel.Nodes.Sum(['foo']);
      const sum2 = new Arel.Nodes.Sum(['foo!']);

      expect(sum1.isEqual(sum2)).toBe(false);
    });
  });

  describe('order', () => {
    it('should order the sum', () => {
      const table = new Arel.Table('users');
      const sql = table.attribute('id').sum().descending().toSql();
      expect(sql).toMatch(/SUM.*users.*id.*DESC/i);
    });
  });
});
