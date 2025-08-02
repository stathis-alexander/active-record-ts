import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('Filter', () => {
  describe('Filter', () => {
    it('should add filter to expression', () => {
      const table = new Arel.Table('users');
      const sql = table.attribute('id').count().filter(table.attribute('income').greaterThanOrEqual(40000)).toSql();
      expect(sql).toMatch(/COUNT\("users"\."id"\) FILTER \(WHERE "users"\."income" >= 40000\)/i);
    });

    describe('as', () => {
      it('should alias the expression', () => {
        const table = new Arel.Table('users');
        const sql = table
          .attribute('id')
          .count()
          .filter(table.attribute('income').greaterThanOrEqual(40000))
          .as('rich_users_count')
          .toSql();
        expect(sql).toMatch(/COUNT\("users"\."id"\) FILTER \(WHERE "users"\."income" >= 40000\) AS rich_users_count/i);
      });
    });

    describe('over', () => {
      it('should reference the window definition by name', () => {
        const table = new Arel.Table('users');
        const window = new Arel.Nodes.Window().partition(table.attribute('year'));
        const sql = table
          .attribute('id')
          .count()
          .filter(table.attribute('income').greaterThanOrEqual(40000))
          .over(window)
          .toSql();

        expect(sql).toMatch(
          /COUNT\("users"\."id"\) FILTER \(WHERE "users"\."income" >= 40000\) OVER \(PARTITION BY "users"\."year"\)/i,
        );
      });
    });
  });
});
