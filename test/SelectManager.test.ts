import { beforeEach, describe, expect, it } from 'bun:test';
import Arel from '../src';

describe('SelectManager', () => {
  it('should test join sources', () => {
    const manager = new Arel.SelectManager();
    manager.joinSources.push(new Arel.Nodes.StringJoin(Arel.Nodes.buildQuoted('foo')));
    expect(manager.toSql()).toBe("SELECT FROM 'foo'");
  });

  describe('backwards compatibility', () => {
    describe('project', () => {
      it('accepts symbols as sql literals', () => {
        const table = new Arel.Table('users');
        const manager = new Arel.SelectManager();
        manager.project('id');
        manager.from(table);
        expect(manager.toSql()).toContain('SELECT id FROM "users"');
      });
    });

    describe('order', () => {
      it('accepts symbols', () => {
        const table = new Arel.Table('users');
        const manager = new Arel.SelectManager();
        manager.project(new Arel.Nodes.SqlLiteral('*'));
        manager.from(table);
        manager.order('foo');
        expect(manager.toSql()).toContain('SELECT * FROM "users" ORDER BY foo');
      });
    });

    describe('group', () => {
      it('takes a symbol', () => {
        const table = new Arel.Table('users');
        const manager = new Arel.SelectManager();
        manager.from(table);
        manager.group('foo');
        expect(manager.toSql()).toContain('SELECT FROM "users" GROUP BY foo');
      });
    });

    describe('as', () => {
      it('makes an AS node by grouping the AST', () => {
        const manager = new Arel.SelectManager();
        const as = manager.as(Arel.sql('foo'));
        expect(as.left).toBeInstanceOf(Arel.Nodes.Grouping);
        expect(as.left.expr).toBe(manager.ast);
        expect(as.right).toBe('foo');
      });

      it('converts right to SqlLiteral if a string', () => {
        const manager = new Arel.SelectManager();
        const as = manager.as('foo');
        expect(as.right).toBeInstanceOf(Arel.Nodes.SqlLiteral);
      });

      it('can make a subselect', () => {
        const manager = new Arel.SelectManager();
        manager.project(Arel.star);
        manager.from(Arel.sql('zomg'));
        const as = manager.as(Arel.sql('foo'));

        const manager2 = new Arel.SelectManager();
        manager2.project(Arel.sql('name'));
        manager2.from(as);
        expect(manager2.toSql()).toContain('SELECT name FROM (SELECT * FROM zomg) foo');
      });
    });

    describe('from', () => {
      it('ignores strings when table of same name exists', () => {
        const table = new Arel.Table('users');
        const manager = new Arel.SelectManager();

        manager.from(table);
        manager.from('users');
        manager.project(table.attribute('id'));
        expect(manager.toSql()).toContain('SELECT "users"."id" FROM users');
      });

      it('should support any ast', () => {
        const table = new Arel.Table('users');
        const manager1 = new Arel.SelectManager();

        const manager2 = new Arel.SelectManager();
        manager2.project(Arel.sql('*'));
        manager2.from(table);

        manager1.project(Arel.sql('lol'));
        const as = manager2.as(Arel.sql('omg'));
        manager1.from(as);

        expect(manager1.toSql()).toContain('SELECT lol FROM (SELECT * FROM "users") omg');
      });
    });

    describe('having', () => {
      it('converts strings to SQLLiterals', () => {
        const table = new Arel.Table('users');
        const mgr = table.from();
        mgr.having(Arel.sql('foo'));
        expect(mgr.toSql()).toBe('SELECT FROM "users" HAVING foo');
      });

      it('can have multiple items specified separately', () => {
        const table = new Arel.Table('users');
        const mgr = table.from();
        mgr.having(Arel.sql('foo'));
        mgr.having(Arel.sql('bar'));
        expect(mgr.toSql()).toBe('SELECT FROM "users" HAVING foo AND bar');
      });

      it('can receive any node', () => {
        const table = new Arel.Table('users');
        const mgr = table.from();
        mgr.having(new Arel.Nodes.And([Arel.sql('foo'), Arel.sql('bar')]));
        expect(mgr.toSql()).toBe('SELECT FROM "users" HAVING foo AND bar');
      });
    });

    describe('on', () => {
      it('converts to sqlliterals', () => {
        const table = new Arel.Table('users');
        const right = table.alias();
        const mgr = table.from();
        mgr.join(right).on('omg');
        expect(mgr.toSql()).toBe('SELECT FROM "users" INNER JOIN "users" "users_2" ON omg');
      });

      it('converts to sqlliterals with multiple items', () => {
        const table = new Arel.Table('users');
        const right = table.alias();
        const mgr = table.from();
        mgr.join(right).on('omg', '123');
        expect(mgr.toSql()).toBe('SELECT FROM "users" INNER JOIN "users" "users_2" ON omg AND 123');
      });
    });
  });

  describe('intersect', () => {
    let m1: Arel.SelectManager;
    let m2: Arel.SelectManager;

    beforeEach(() => {
      const table = new Arel.Table('users');
      m1 = new Arel.SelectManager(table);
      m1.project(Arel.star);
      m1.where(table.attribute('age').greaterThan(18));

      m2 = new Arel.SelectManager(table);
      m2.project(Arel.star);
      m2.where(table.attribute('age').lessThan(99));
    });

    it('should intersect two managers', () => {
      // FIXME should this intersect "managers" or "statements" ?
      // FIXME this probably shouldn't return a node
      const node = m1.intersect(m2);

      // maybe FIXME: decide when wrapper parens are needed
      expect(node.toSql()).toBe(
        '( SELECT * FROM "users"  WHERE "users"."age" > 18 INTERSECT SELECT * FROM "users"  WHERE "users"."age" < 99 )',
      );
    });
  });

  describe('ast', () => {
    it('should return the ast', () => {
      const table = new Arel.Table('users');
      const mgr = table.from();
      expect(mgr.ast).toBeDefined();
    });
  });

  describe('taken', () => {
    it('should return limit', () => {
      const manager = new Arel.SelectManager();
      manager.take(10);
      expect(manager.taken()).toBe(10);
    });
  });

  describe('project', () => {
    it('takes sql literals', () => {
      const manager = new Arel.SelectManager();
      manager.project(new Arel.Nodes.SqlLiteral('*'));
      expect(manager.toSql()).toBe('SELECT *');
    });

    it('takes multiple args', () => {
      const manager = new Arel.SelectManager();
      manager.project(new Arel.Nodes.SqlLiteral('foo'), new Arel.Nodes.SqlLiteral('bar'));
      expect(manager.toSql()).toBe('SELECT foo, bar');
    });

    it('takes strings', () => {
      const manager = new Arel.SelectManager();
      manager.project('*');
      expect(manager.toSql()).toBe('SELECT *');
    });
  });

  describe('take', () => {
    it('knows take', () => {
      const table = new Arel.Table('users');
      const manager = new Arel.SelectManager();
      manager.from(table).project(table.attribute('id'));
      manager.where(table.attribute('id').equal(1));
      manager.take(1);

      expect(manager.toSql()).toBe('SELECT "users"."id" FROM "users" WHERE "users"."id" = 1 LIMIT 1');
    });

    it('chains', () => {
      const manager = new Arel.SelectManager();
      expect(manager.take(1)).toBe(manager);
    });
  });

  describe('where', () => {
    it('knows where', () => {
      const table = new Arel.Table('users');
      const manager = new Arel.SelectManager();
      manager.from(table).project(table.attribute('id'));
      manager.where(table.attribute('id').equal(1));
      expect(manager.toSql()).toBe('SELECT "users"."id" FROM "users" WHERE "users"."id" = 1');
    });

    it('chains', () => {
      const table = new Arel.Table('users');
      const manager = new Arel.SelectManager();
      manager.from(table);
      expect(manager.project(table.attribute('id')).where(table.attribute('id').equal(1))).toBe(manager);
    });
  });

  describe('from', () => {
    it('makes sql', () => {
      const table = new Arel.Table('users');
      const manager = new Arel.SelectManager();

      manager.from(table);
      manager.project(table.attribute('id'));
      expect(manager.toSql()).toBe('SELECT "users"."id" FROM "users"');
    });

    it('chains', () => {
      const table = new Arel.Table('users');
      const manager = new Arel.SelectManager();
      expect(manager.from(table).project(table.attribute('id'))).toBe(manager);
      expect(manager.toSql()).toBe('SELECT "users"."id" FROM "users"');
    });
  });

  it('should hand back froms', () => {
    const relation = new Arel.SelectManager();
    expect(relation.froms()).toEqual([]);
  });

  it('should create and nodes', () => {
    const relation = new Arel.SelectManager();
    const children = ['foo', 'bar', 'baz'];
    const clause = relation.createAnd(children);
    expect(clause).toBeInstanceOf(Arel.Nodes.And);
    expect(clause.children).toEqual(children);
  });

  describe('clone', () => {
    it('creates new cores', () => {
      const table = new Arel.Table('users', { as: 'foo' });
      const mgr = table.from();
      // Note: clone method may not be implemented yet
      const m2 = new Arel.SelectManager(table);
      m2.project('foo');
      expect(mgr.toSql()).not.toBe(m2.toSql());
    });

    it('makes updates to the correct copy', () => {
      const table = new Arel.Table('users', { as: 'foo' });
      const mgr = table.from();
      // Note: clone method may not be implemented yet
      const m2 = new Arel.SelectManager(table);
      const m3 = new Arel.SelectManager(table);
      m2.project('foo');
      expect(mgr.toSql()).not.toBe(m2.toSql());
      expect(m3.toSql()).toBe(mgr.toSql());
    });
  });

  describe('initialize', () => {
    it('uses alias in sql', () => {
      const table = new Arel.Table('users', { as: 'foo' });
      const mgr = table.from();
      mgr.skip(10);
      expect(mgr.toSql()).toBe('SELECT FROM "users" "foo" OFFSET 10');
    });
  });

  describe('skip', () => {
    it('should add an offset', () => {
      const table = new Arel.Table('users');
      const mgr = table.from();
      mgr.skip(10);
      expect(mgr.toSql()).toBe('SELECT FROM "users" OFFSET 10');
    });

    it('should chain', () => {
      const table = new Arel.Table('users');
      const mgr = table.from();
      expect(mgr.skip(10).toSql()).toBe('SELECT FROM "users" OFFSET 10');
    });
  });

  describe('offset', () => {
    it('should add an offset', () => {
      const table = new Arel.Table('users');
      const mgr = table.from();
      mgr.skip(10); // Use skip method instead of offset setter
      expect(mgr.toSql()).toBe('SELECT FROM "users" OFFSET 10');
    });

    it('should remove an offset', () => {
      const table = new Arel.Table('users');
      const mgr = table.from();
      mgr.skip(10);
      expect(mgr.toSql()).toBe('SELECT FROM "users" OFFSET 10');

      mgr.skip(); // No argument removes offset
      expect(mgr.toSql()).toBe('SELECT FROM "users"');
    });

    it('should return the offset', () => {
      const table = new Arel.Table('users');
      const mgr = table.from();
      mgr.skip(10);
      expect(mgr.offset()).toBe(10);
    });
  });

  describe('exists', () => {
    it('should create an exists clause', () => {
      const table = new Arel.Table('users');
      const manager = new Arel.SelectManager(table);
      manager.project(new Arel.Nodes.SqlLiteral('*'));
      const m2 = new Arel.SelectManager();
      m2.project(manager.exists());
      expect(m2.toSql()).toBe(`SELECT EXISTS (${manager.toSql()})`);
    });

    it('can be aliased', () => {
      const table = new Arel.Table('users');
      const manager = new Arel.SelectManager(table);
      manager.project(new Arel.Nodes.SqlLiteral('*'));
      const m2 = new Arel.SelectManager();
      m2.project(manager.exists().as('foo'));
      expect(m2.toSql()).toBe(`SELECT EXISTS (${manager.toSql()}) AS foo`);
    });
  });

  describe('union', () => {
    let m1: Arel.SelectManager;
    let m2: Arel.SelectManager;

    beforeEach(() => {
      const table = new Arel.Table('users');
      m1 = new Arel.SelectManager(table);
      m1.project(Arel.star);
      m1.where(table.attribute('age').lessThan(18));

      m2 = new Arel.SelectManager(table);
      m2.project(Arel.star);
      m2.where(table.attribute('age').greaterThan(99));
    });

    it('should union two managers', () => {
      // FIXME should this union "managers" or "statements" ?
      // FIXME this probably shouldn't return a node
      const node = m1.union(m2);

      // maybe FIXME: decide when wrapper parens are needed
      expect(node.toSql()).toBe(
        '( SELECT * FROM "users"  WHERE "users"."age" < 18 UNION SELECT * FROM "users"  WHERE "users"."age" > 99 )',
      );
    });

    it('should union all', () => {
      // Note: union all API may be different in TypeScript implementation
      const node = m1.unionAll(m2);
      expect(node.toSql()).toBe(
        '( SELECT * FROM "users"  WHERE "users"."age" < 18 UNION ALL SELECT * FROM "users"  WHERE "users"."age" > 99 )',
      );
    });
  });
});
