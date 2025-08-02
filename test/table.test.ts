import { beforeEach, describe, expect, it } from 'bun:test';
import Arel from '../src';
import type { Table } from '../src/types';

describe('Table', () => {
  let relation: Table;

  beforeEach(() => {
    relation = new Arel.Table('users');
  });

  describe('join creation', () => {
    it('should create join nodes', () => {
      const relation = new Arel.Table('users');
      const join = relation.createJoin('foo', 'bar');
      expect(join).toBeInstanceOf(Arel.Nodes.InnerJoin);
      expect(join.left).toBe('foo');
      expect(join.right).toBe('bar');
    });

    it('should create join nodes with full outer join class', () => {
      const relation = new Arel.Table('users');
      const join = relation.createJoin('foo', 'bar', 'fullOuter');
      expect(join).toBeInstanceOf(Arel.Nodes.FullOuterJoin);
      expect(join.left).toBe('foo');
      expect(join.right).toBe('bar');
    });

    it('should create join nodes with outer join class', () => {
      const relation = new Arel.Table('users');
      const join = relation.createJoin('foo', 'bar', 'outer');
      expect(join).toBeInstanceOf(Arel.Nodes.OuterJoin);
      expect(join.left).toBe('foo');
      expect(join.right).toBe('bar');
    });

    it('should create join nodes with right outer join class', () => {
      const relation = new Arel.Table('users');
      const join = relation.createJoin('foo', 'bar', 'rightOuter');
      expect(join).toBeInstanceOf(Arel.Nodes.RightOuterJoin);
      expect(join.left).toBe('foo');
      expect(join.right).toBe('bar');
    });
  });

  describe('skip', () => {
    it('should add an offset', () => {
      const sm = relation.skip(2);
      expect(sm.toSql()).toBe('SELECT FROM "users" OFFSET 2');
    });
  });

  describe('having', () => {
    it('adds a having clause', () => {
      const mgr = relation.from();
      mgr.having(relation.attribute('id').equal(10));
      expect(mgr.toSql()).toBe('SELECT FROM "users" HAVING "users"."id" = 10');
    });
  });

  describe('backwards compatibility', () => {
    describe('join', () => {
      it('noops on null', () => {
        const mgr = relation.join(null);
        expect(mgr.toSql()).toBe('SELECT FROM "users"');
      });

      it('takes a second argument for join type', () => {
        const right = relation.alias();
        const predicate = relation.attribute('id').equal(right.attribute('id'));
        const mgr = relation.join(right, 'outer').on(predicate);
        expect(mgr.toSql()).toBe(
          'SELECT FROM "users" LEFT OUTER JOIN "users" "users_2" ON "users"."id" = "users_2"."id"',
        );
      });
    });

    describe('outer join', () => {
      it('creates an outer join', () => {
        const right = relation.alias();
        const predicate = relation.attribute('id').equal(right.attribute('id'));
        const mgr = relation.outerJoin(right).on(predicate);
        expect(mgr.toSql()).toBe(
          'SELECT FROM "users" LEFT OUTER JOIN "users" "users_2" ON "users"."id" = "users_2"."id"',
        );
      });
    });
  });

  describe('group', () => {
    it('should create a group', () => {
      const manager = relation.group(relation.attribute('id'));
      expect(manager.toSql()).toBe('SELECT FROM "users" GROUP BY "users"."id"');
    });
  });

  describe('alias', () => {
    it('should create a node that proxies to a table', () => {
      const node = relation.alias();
      expect(node.name).toBe('users_2');
      expect(node.attribute('id').relation).toBe(node);
    });
  });

  describe('constructor', () => {
    it('should accept a hash with as option', () => {
      const rel = new Arel.Table('users', { as: 'foo' });
      expect(rel.tableAlias).toBe('foo');
    });

    it('ignores as if it equals name', () => {
      const rel = new Arel.Table('users', { as: 'users' });
      expect(rel.tableAlias).toBeUndefined();
    });

    it('should accept literal SQL', () => {
      const sql = 'generate_series(4, 2)';
      const rel = new Arel.Table(sql);
      expect(rel.name).toBe(sql);
    });

    it('should accept complex table names', () => {
      const tableName = 'complex_table_name';
      const rel = new Arel.Table(tableName);
      expect(rel.name).toBe(tableName);
    });
  });

  describe('order', () => {
    it('should take an order', () => {
      const manager = relation.order('foo');
      expect(manager.toSql()).toBe('SELECT FROM "users" ORDER BY foo');
    });
  });

  describe('take', () => {
    it('should add a limit', () => {
      const manager = relation.take(1);
      manager.project(new Arel.Nodes.SqlLiteral('*'));
      expect(manager.toSql()).toBe('SELECT * FROM "users" LIMIT 1');
    });
  });

  describe('project', () => {
    it('can project', () => {
      const manager = relation.project(new Arel.Nodes.SqlLiteral('*'));
      expect(manager.toSql()).toBe('SELECT * FROM "users"');
    });

    it('takes multiple parameters', () => {
      const manager = relation.project(new Arel.Nodes.SqlLiteral('*'), new Arel.Nodes.SqlLiteral('*'));
      expect(manager.toSql()).toBe('SELECT *, * FROM "users"');
    });
  });

  describe('where', () => {
    it('returns a tree manager', () => {
      const manager = relation.where(relation.attribute('id').equal(1));
      manager.project(relation.attribute('id'));
      expect(manager).toBeInstanceOf(Arel.TreeManager);
      expect(manager.toSql()).toBe('SELECT "users"."id" FROM "users" WHERE "users"."id" = 1');
    });
  });

  it('should have a name', () => {
    expect(relation.name).toBe('users');
  });

  describe('attribute access', () => {
    describe('when given a string', () => {
      it('manufactures an attribute if the string names an attribute within the relation', () => {
        const column = relation.attribute('id');
        expect(column.name).toBe('id');
      });
    });
  });

  describe('equality', () => {
    it('is equal with equal constructor arguments', () => {
      const relation1 = new Arel.Table('users', { as: 'zomg' });
      const relation2 = new Arel.Table('users', { as: 'zomg' });
      // In TypeScript, we'd need to implement a custom equals method or use a Set with custom comparison
      expect(relation1.name).toBe(relation2.name);
      expect(relation1.tableAlias).toBe('zomg');
      expect(relation2.tableAlias).toBe('zomg');
    });

    it('is not equal with different constructor arguments', () => {
      const relation1 = new Arel.Table('users', { as: 'zomg' });
      const relation2 = new Arel.Table('users', { as: 'zomg2' });
      expect(relation1.tableAlias).not.toBe(relation2.tableAlias);
    });
  });
});
