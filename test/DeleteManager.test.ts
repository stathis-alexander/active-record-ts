import { describe, expect, it } from 'bun:test';
import Arel from '../src';

describe('DeleteManager', () => {
  it('handles limit properly', () => {
    const table = new Arel.Table('users');
    const dm = new Arel.DeleteManager();
    dm.take(10);
    dm.from(table);
    dm.key = 'id';
    expect(dm.toSql()).toMatch(/LIMIT 10/);
  });

  describe('from', () => {
    it('uses from', () => {
      const table = new Arel.Table('users');
      const dm = new Arel.DeleteManager();
      dm.from(table);
      expect(dm.toSql()).toContain('DELETE FROM "users"');
    });

    it('chains', () => {
      const table = new Arel.Table('users');
      const dm = new Arel.DeleteManager();
      expect(dm.from(table)).toBe(dm);
    });
  });

  describe('where', () => {
    it('uses where values', () => {
      const table = new Arel.Table('users');
      const dm = new Arel.DeleteManager();
      dm.from(table);
      dm.where(table.attribute('id').equal(10));
      expect(dm.toSql()).toContain('DELETE FROM "users" WHERE "users"."id" = 10');
    });

    it('chains', () => {
      const table = new Arel.Table('users');
      const dm = new Arel.DeleteManager();
      expect(dm.where(table.attribute('id').equal(10))).toBe(dm);
    });
  });
});
