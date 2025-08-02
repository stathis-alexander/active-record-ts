import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('Extract', () => {
  it('should extract field', () => {
    const table = new Arel.Table('users');
    const sql = table.attribute('timestamp').extract('date').toSql();
    expect(sql).toMatch(/EXTRACT\(DATE FROM "users"\."timestamp"\)/i);
  });

  describe('as', () => {
    it('should alias the extract', () => {
      const table = new Arel.Table('users');
      const sql = table.attribute('timestamp').extract('date').as('foo').toSql();
      expect(sql).toMatch(/EXTRACT\(DATE FROM "users"\."timestamp"\) AS foo/i);
    });

    it('should not mutate the extract', () => {
      const table = new Arel.Table('users');
      const extract = table.attribute('timestamp').extract('date');
      const before = { ...extract }; // Simple copy for comparison
      extract.as('foo');
      expect(extract.expression).toEqual(before.expression);
      expect(extract.field).toEqual(before.field);
    });
  });

  describe('equality', () => {
    it('is equal with equal ivars', () => {
      const table = new Arel.Table('users');
      const extract1 = table.attribute('attr').extract('foo');
      const extract2 = table.attribute('attr').extract('foo');

      expect(extract1.isEqual(extract2)).toBe(true);
    });

    it('is not equal with different ivars', () => {
      const table = new Arel.Table('users');
      const extract1 = table.attribute('attr').extract('foo');
      const extract2 = table.attribute('attr').extract('bar');

      expect(extract1.isEqual(extract2)).toBe(false);
    });
  });
});
