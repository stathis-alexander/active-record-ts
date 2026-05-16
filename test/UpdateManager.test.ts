import { beforeEach, describe, expect, it } from 'bun:test';
import Arel from '../src';
import { expectInstance } from './_helpers';

describe('UpdateManager', () => {
  it('should not quote sql literals', () => {
    const table = new Arel.Table('users');
    const um = new Arel.UpdateManager();
    um.table(table);
    um.set([[table.attribute('name'), new Arel.Nodes.BindParam(1)]]);
    expect(um.toSql()).toContain('UPDATE "users" SET "name" = ?');
  });

  it('handles limit properly', () => {
    const table = new Arel.Table('users');
    const um = new Arel.UpdateManager();
    um.key = 'id';
    um.take(10);
    um.table(table);
    um.set([[table.attribute('name'), null]]);
    expect(um.toSql()).toMatch(/LIMIT 10/);
  });

  describe('having', () => {
    it('sets having', () => {
      const users = new Arel.Table('users');
      const posts = new Arel.Table('posts');
      const joinSource = new Arel.Nodes.InnerJoin(users, posts);

      const updateManager = new Arel.UpdateManager();
      updateManager.table(joinSource);
      updateManager.group(['posts.id']);
      updateManager.having('count(posts.id) >= 2');

      expect(updateManager.ast.havings).toEqual(['count(posts.id) >= 2']);
    });
  });

  describe('group', () => {
    it('adds columns to the AST when group value is a String', () => {
      const users = new Arel.Table('users');
      const posts = new Arel.Table('posts');
      const joinSource = new Arel.Nodes.InnerJoin(users, posts);

      const updateManager = new Arel.UpdateManager();
      updateManager.table(joinSource);
      updateManager.group(['posts.id']);
      updateManager.having('count(posts.id) >= 2');

      expect(updateManager.ast.groups.length).toBe(1);
      const groupAst = expectInstance(updateManager.ast.groups[0], Arel.Nodes.Group);
      expect(groupAst.expr).toBe('posts.id');
      expect(updateManager.ast.havings).toEqual(['count(posts.id) >= 2']);
    });

    it('adds columns to the AST when group value is a Symbol', () => {
      const users = new Arel.Table('users');
      const posts = new Arel.Table('posts');
      const joinSource = new Arel.Nodes.InnerJoin(users, posts);

      const updateManager = new Arel.UpdateManager();
      updateManager.table(joinSource);
      updateManager.group(['posts.id']); // Note: TypeScript doesn't have symbols like Ruby
      updateManager.having('count(posts.id) >= 2');

      expect(updateManager.ast.groups.length).toBe(1);
      const groupAst = expectInstance(updateManager.ast.groups[0], Arel.Nodes.Group);
      expect(groupAst.expr).toBe('posts.id');
      expect(updateManager.ast.havings).toEqual(['count(posts.id) >= 2']);
    });
  });

  describe('set', () => {
    it('updates with null', () => {
      const table = new Arel.Table('users');
      const um = new Arel.UpdateManager();
      um.table(table);
      um.set([[table.attribute('name'), null]]);
      expect(um.toSql()).toContain('UPDATE "users" SET "name" = NULL');
    });

    it('takes a string', () => {
      const table = new Arel.Table('users');
      const um = new Arel.UpdateManager();
      um.table(table);
      um.set(new Arel.Nodes.SqlLiteral('foo = bar'));
      expect(um.toSql()).toContain('UPDATE "users" SET foo = bar');
    });

    it('takes a list of lists', () => {
      const table = new Arel.Table('users');
      const um = new Arel.UpdateManager();
      um.table(table);
      um.set([
        [table.attribute('id'), 1],
        [table.attribute('name'), 'hello'],
      ]);
      expect(um.toSql()).toContain('UPDATE "users" SET "id" = 1, "name" = \'hello\'');
    });

    it('chains', () => {
      const table = new Arel.Table('users');
      const um = new Arel.UpdateManager();
      const result = um.set([
        [table.attribute('id'), 1],
        [table.attribute('name'), 'hello'],
      ]);
      expect(result).toBe(um);
    });
  });

  describe('table', () => {
    it('generates an update statement', () => {
      const um = new Arel.UpdateManager();
      um.table(new Arel.Table('users'));
      expect(um.toSql()).toContain('UPDATE "users"');
    });

    it('chains', () => {
      const um = new Arel.UpdateManager();
      const result = um.table(new Arel.Table('users'));
      expect(result).toBe(um);
    });

    it('generates an update statement with joins', () => {
      const um = new Arel.UpdateManager();

      const table = new Arel.Table('users');
      // Rails: `table.create_join(Table.new(:posts))` returns InnerJoin(posts, nil).
      const joinSource = new Arel.Nodes.JoinSource(table, [table.createJoin(new Arel.Table('posts'))]);

      um.table(joinSource);
      expect(um.toSql()).toContain('UPDATE "users" INNER JOIN "posts"');
    });
  });

  describe('where', () => {
    it('generates a where clause', () => {
      const table = new Arel.Table('users');
      const um = new Arel.UpdateManager();
      um.table(table);
      um.where(table.attribute('id').equal(1));
      expect(um.toSql()).toContain('UPDATE "users" WHERE "users"."id" = 1');
    });

    it('chains', () => {
      const table = new Arel.Table('users');
      const um = new Arel.UpdateManager();
      um.table(table);
      const result = um.where(table.attribute('id').equal(1));
      expect(result).toBe(um);
    });
  });

  describe('key', () => {
    let um: Arel.UpdateManager;

    beforeEach(() => {
      um = new Arel.UpdateManager();
      um.key = 'foo';
    });

    it('can be set', () => {
      expect(um.ast.key).toBe('foo');
    });

    it('can be accessed', () => {
      expect(um.key).toBe('foo');
    });
  });

  describe('returning', () => {
    it('accepts a returning clause', () => {
      const users = new Arel.Table('users');
      const manager = new Arel.UpdateManager();
      manager.table(users);
      manager.returning(Arel.star);

      expect(manager.toSql()).toContain('UPDATE "users" RETURNING *');
    });

    it('accepts multiple values as returning clause', () => {
      const users = new Arel.Table('users');
      const manager = new Arel.UpdateManager();
      manager.table(users);
      manager.returning(Arel.star);
      manager.returning([users.attribute('id'), users.attribute('name')]);

      expect(manager.toSql()).toContain('UPDATE "users" RETURNING *, "users"."id", "users"."name"');
    });

    it('chains', () => {
      const manager = new Arel.UpdateManager();
      expect(manager.returning(Arel.star)).toBe(manager);
    });
  });
});
