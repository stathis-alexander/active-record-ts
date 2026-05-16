import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('Over', () => {
  describe('as', () => {
    it('should alias the expression', () => {
      const table = new Arel.Table('users');
      const sql = table.attribute('id').count().over().as('foo').toSql();
      expect(sql).toMatch(/COUNT.*users.*id.*OVER.*AS foo/i);
    });
  });

  describe('with literal', () => {
    it('should reference the window definition by name', () => {
      const table = new Arel.Table('users');
      const sql = table.attribute('id').count().over('foo').toSql();
      expect(sql).toMatch(/COUNT\("users"\."id"\) OVER "foo"/i);
    });
  });

  describe('with SQL literal', () => {
    it('should reference the window definition by name', () => {
      const table = new Arel.Table('users');
      const sql = table.attribute('id').count().over(Arel.sql('foo')).toSql();
      expect(sql).toMatch(/COUNT\("users"\."id"\) OVER foo/i);
    });
  });

  describe('with no expression', () => {
    it('should use empty definition', () => {
      const table = new Arel.Table('users');
      const sql = table.attribute('id').count().over().toSql();
      expect(sql).toMatch(/COUNT.*users.*id.*OVER.*\(\)/i);
    });
  });

  describe('with expression', () => {
    it('should use definition in sub-expression', () => {
      const table = new Arel.Table('users');
      const window = new Arel.Nodes.Window().order(table.attribute('foo'));
      const sql = table.attribute('id').count().over(window).toSql();
      expect(sql).toMatch(/COUNT\("users"\."id"\) OVER \(ORDER BY "users"\."foo"\)/i);
    });
  });

  describe('equality', () => {
    it('is equal with equal ivars', () => {
      const over1 = new Arel.Nodes.Over('foo', 'bar');
      const over2 = new Arel.Nodes.Over('foo', 'bar');

      expect(over1.isEqual(over2)).toBe(true);
    });

    it('is not equal with different ivars', () => {
      const over1 = new Arel.Nodes.Over('foo', 'bar');
      const over2 = new Arel.Nodes.Over('foo', 'baz');

      expect(over1.isEqual(over2)).toBe(false);
    });
  });
});
