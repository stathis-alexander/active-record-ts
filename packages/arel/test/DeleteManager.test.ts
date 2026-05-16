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

  describe('returning', () => {
    it('accepts a returning clause', () => {
      const users = new Arel.Table('users');
      const manager = new Arel.DeleteManager();
      manager.from(users);
      manager.returning(Arel.star);

      expect(manager.toSql()).toContain('DELETE FROM "users" RETURNING *');
    });

    it('accepts multiple values as returning clause', () => {
      const users = new Arel.Table('users');
      const manager = new Arel.DeleteManager();
      manager.from(users);
      manager.returning(Arel.star);
      manager.returning([users.attribute('id'), users.attribute('name')]);

      expect(manager.toSql()).toContain('DELETE FROM "users" RETURNING *, "users"."id", "users"."name"');
    });

    it('chains', () => {
      const manager = new Arel.DeleteManager();

      expect(manager.returning(Arel.star)).toBe(manager);
    });
  });
});
