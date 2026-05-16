import { beforeEach, describe, expect, it } from 'bun:test';
import type { Attribute, Table } from '../../src';
import Arel from '../../src';

const SelectStatement = Arel.Nodes.SelectStatement;
const SelectCore = Arel.Nodes.SelectCore;
const Limit = Arel.Nodes.Limit;
const DistinctOn = Arel.Nodes.DistinctOn;
const Distinct = Arel.Nodes.Distinct;

describe('Visitors.PostgreSQL', () => {
  let table: Table;
  let attr: Attribute;
  let visitor: Arel.Visitors.PostgreSQL;

  beforeEach(() => {
    visitor = new Arel.Visitors.PostgreSQL();
    table = new Arel.Table('users');
    attr = table.attribute('id');
  });

  function compile(node: unknown): string {
    return visitor.accept(node, new Arel.Collectors.SqlString()).value();
  }

  describe('locking', () => {
    it('defaults to FOR UPDATE', () => {
      const node = new Arel.Nodes.Lock(Arel.sql('FOR UPDATE'));
      expect(compile(node)).toContain('FOR UPDATE');
    });

    it('allows a custom string to be used as a lock', () => {
      const node = new Arel.Nodes.Lock(Arel.sql('FOR SHARE'));
      expect(compile(node)).toContain('FOR SHARE');
    });
  });

  it('should escape LIMIT', () => {
    const sc = new SelectStatement();
    sc.limit = new Limit(Arel.sql('omg'));
    sc.cores[0]?.projections.push(Arel.sql('DISTINCT ON'));
    sc.orders.push(Arel.sql('xyz'));
    const sql = compile(sc);
    expect(sql).toMatch(/LIMIT 'omg'/);
    expect(sql.match(/LIMIT/g)?.length).toBe(1);
  });

  it('should support DISTINCT ON', () => {
    const core = new SelectCore();
    core.setQuantifier = new DistinctOn(Arel.sql('aaron'));
    expect(compile(core)).toContain('DISTINCT ON ( aaron )');
  });

  it('should support DISTINCT', () => {
    const core = new SelectCore();
    core.setQuantifier = new Distinct();
    expect(compile(core)).toBe('SELECT DISTINCT');
  });

  it('encloses LATERAL queries in parens', () => {
    const subquery = table.project('id').where(table.attribute('name').matches('foo%'));
    expect(compile(subquery.lateral())).toContain(
      'LATERAL (SELECT id FROM "users" WHERE "users"."name" ILIKE \'foo%\')',
    );
  });

  it('produces LATERAL queries with alias', () => {
    const subquery = table.project('id').where(table.attribute('name').matches('foo%'));
    expect(compile(subquery.lateral('bar'))).toContain(
      'LATERAL (SELECT id FROM "users" WHERE "users"."name" ILIKE \'foo%\') bar',
    );
  });

  describe('Nodes.Matches', () => {
    it('should know how to visit', () => {
      const node = table.attribute('name').matches('foo%');
      expect(node).toBeInstanceOf(Arel.Nodes.Matches);
      expect(node.caseSensitive).toBe(false);
      expect(compile(node)).toContain('"users"."name" ILIKE \'foo%\'');
    });

    it('should know how to visit case sensitive', () => {
      const node = table.attribute('name').matches('foo%', null, true);
      expect(node.caseSensitive).toBe(true);
      expect(compile(node)).toContain('"users"."name" LIKE \'foo%\'');
    });

    it('can handle ESCAPE', () => {
      const node = table.attribute('name').matches('foo!%', '!');
      expect(compile(node)).toContain('"users"."name" ILIKE \'foo!%\' ESCAPE \'!\'');
    });

    it('can handle subqueries', () => {
      const subquery = table.project('id').where(table.attribute('name').matches('foo%'));
      const node = attr.in(subquery);
      expect(compile(node)).toContain('"users"."id" IN (SELECT id FROM "users" WHERE "users"."name" ILIKE \'foo%\')');
    });
  });

  describe('Nodes.DoesNotMatch', () => {
    it('should know how to visit', () => {
      const node = table.attribute('name').doesNotMatch('foo%');
      expect(node).toBeInstanceOf(Arel.Nodes.DoesNotMatch);
      expect(node.caseSensitive).toBe(false);
      expect(compile(node)).toContain('"users"."name" NOT ILIKE \'foo%\'');
    });

    it('should know how to visit case sensitive', () => {
      const node = table.attribute('name').doesNotMatch('foo%', null, true);
      expect(node.caseSensitive).toBe(true);
      expect(compile(node)).toContain('"users"."name" NOT LIKE \'foo%\'');
    });

    it('can handle ESCAPE', () => {
      const node = table.attribute('name').doesNotMatch('foo!%', '!');
      expect(compile(node)).toContain('"users"."name" NOT ILIKE \'foo!%\' ESCAPE \'!\'');
    });

    it('can handle subqueries', () => {
      const subquery = table.project('id').where(table.attribute('name').doesNotMatch('foo%'));
      const node = attr.in(subquery);
      expect(compile(node)).toContain(
        '"users"."id" IN (SELECT id FROM "users" WHERE "users"."name" NOT ILIKE \'foo%\')',
      );
    });
  });

  describe('Nodes.Regexp', () => {
    it('should know how to visit', () => {
      const node = table.attribute('name').matchesRegexp('foo.*');
      expect(node).toBeInstanceOf(Arel.Nodes.Regexp);
      expect(node.caseSensitive).toBe(true);
      expect(compile(node)).toContain('"users"."name" ~ \'foo.*\'');
    });

    it('can handle case insensitive', () => {
      const node = table.attribute('name').matchesRegexp('foo.*', false);
      expect(node).toBeInstanceOf(Arel.Nodes.Regexp);
      expect(node.caseSensitive).toBe(false);
      expect(compile(node)).toContain('"users"."name" ~* \'foo.*\'');
    });

    it('can handle subqueries', () => {
      const subquery = table.project('id').where(table.attribute('name').matchesRegexp('foo.*'));
      const node = attr.in(subquery);
      expect(compile(node)).toContain('"users"."id" IN (SELECT id FROM "users" WHERE "users"."name" ~ \'foo.*\')');
    });
  });

  describe('Nodes.NotRegexp', () => {
    it('should know how to visit', () => {
      const node = table.attribute('name').doesNotMatchRegexp('foo.*');
      expect(node).toBeInstanceOf(Arel.Nodes.NotRegexp);
      expect(node.caseSensitive).toBe(true);
      expect(compile(node)).toContain('"users"."name" !~ \'foo.*\'');
    });

    it('can handle case insensitive', () => {
      const node = table.attribute('name').doesNotMatchRegexp('foo.*', false);
      expect(node.caseSensitive).toBe(false);
      expect(compile(node)).toContain('"users"."name" !~* \'foo.*\'');
    });

    it('can handle subqueries', () => {
      const subquery = table.project('id').where(table.attribute('name').doesNotMatchRegexp('foo.*'));
      const node = attr.in(subquery);
      expect(compile(node)).toContain('"users"."id" IN (SELECT id FROM "users" WHERE "users"."name" !~ \'foo.*\')');
    });
  });

  describe('Nodes.BindParam', () => {
    it('increments each bind param', () => {
      const query = table
        .attribute('name')
        .equal(new Arel.Nodes.BindParam(1))
        .and(table.attribute('id').equal(new Arel.Nodes.BindParam(1)));
      expect(compile(query)).toContain('"users"."name" = $1 AND "users"."id" = $2');
    });
  });

  describe('Nodes.Cube', () => {
    it('should know how to visit with array arguments', () => {
      const node = new Arel.Nodes.Cube([table.attribute('name'), table.attribute('bool')]);
      expect(compile(node)).toContain('CUBE( "users"."name", "users"."bool" )');
    });

    it('should know how to visit with CubeDimension Argument', () => {
      const dimensions = new Arel.Nodes.GroupingElement([table.attribute('name'), table.attribute('bool')]);
      const node = new Arel.Nodes.Cube(dimensions);
      expect(compile(node)).toContain('CUBE( "users"."name", "users"."bool" )');
    });

    it('should know how to generate parenthesis when supplied with many Dimensions', () => {
      const dim1 = new Arel.Nodes.GroupingElement(table.attribute('name'));
      const dim2 = new Arel.Nodes.GroupingElement([table.attribute('bool'), table.attribute('created_at')]);
      const node = new Arel.Nodes.Cube([dim1, dim2]);
      expect(compile(node)).toContain('CUBE( ( "users"."name" ), ( "users"."bool", "users"."created_at" ) )');
    });
  });

  describe('Nodes.GroupingSet', () => {
    it('should know how to visit with array arguments', () => {
      const node = new Arel.Nodes.GroupingSet([table.attribute('name'), table.attribute('bool')]);
      expect(compile(node)).toContain('GROUPING SETS( "users"."name", "users"."bool" )');
    });

    it('should know how to visit with CubeDimension Argument', () => {
      const group = new Arel.Nodes.GroupingElement([table.attribute('name'), table.attribute('bool')]);
      const node = new Arel.Nodes.GroupingSet(group);
      expect(compile(node)).toContain('GROUPING SETS( "users"."name", "users"."bool" )');
    });

    it('should know how to generate parenthesis when supplied with many Dimensions', () => {
      const group1 = new Arel.Nodes.GroupingElement(table.attribute('name'));
      const group2 = new Arel.Nodes.GroupingElement([table.attribute('bool'), table.attribute('created_at')]);
      const node = new Arel.Nodes.GroupingSet([group1, group2]);
      expect(compile(node)).toContain('GROUPING SETS( ( "users"."name" ), ( "users"."bool", "users"."created_at" ) )');
    });
  });

  describe('Nodes.RollUp', () => {
    it('should know how to visit with array arguments', () => {
      const node = new Arel.Nodes.RollUp([table.attribute('name'), table.attribute('bool')]);
      expect(compile(node)).toContain('ROLLUP( "users"."name", "users"."bool" )');
    });

    it('should know how to visit with CubeDimension Argument', () => {
      const group = new Arel.Nodes.GroupingElement([table.attribute('name'), table.attribute('bool')]);
      const node = new Arel.Nodes.RollUp(group);
      expect(compile(node)).toContain('ROLLUP( "users"."name", "users"."bool" )');
    });

    it('should know how to generate parenthesis when supplied with many Dimensions', () => {
      const group1 = new Arel.Nodes.GroupingElement(table.attribute('name'));
      const group2 = new Arel.Nodes.GroupingElement([table.attribute('bool'), table.attribute('created_at')]);
      const node = new Arel.Nodes.RollUp([group1, group2]);
      expect(compile(node)).toContain('ROLLUP( ( "users"."name" ), ( "users"."bool", "users"."created_at" ) )');
    });
  });

  describe('Nodes.IsNotDistinctFrom', () => {
    it('should construct a valid generic SQL statement', () => {
      const test = table.attribute('name').isNotDistinctFrom('Aaron Patterson');
      expect(compile(test)).toContain('"users"."name" IS NOT DISTINCT FROM \'Aaron Patterson\'');
    });

    it('should handle column names on both sides', () => {
      const test = table.attribute('first_name').isNotDistinctFrom(table.attribute('last_name'));
      expect(compile(test)).toContain('"users"."first_name" IS NOT DISTINCT FROM "users"."last_name"');
    });

    it('should handle nil', () => {
      const test = new Arel.Nodes.IsNotDistinctFrom(table.attribute('name'), null);
      const sql = compile(test);
      expect(sql).toContain('"users"."name" IS NOT DISTINCT FROM NULL');
    });
  });

  describe('Nodes.IsDistinctFrom', () => {
    it('should handle column names on both sides', () => {
      const test = table.attribute('first_name').isDistinctFrom(table.attribute('last_name'));
      expect(compile(test)).toContain('"users"."first_name" IS DISTINCT FROM "users"."last_name"');
    });

    it('should handle nil', () => {
      const test = new Arel.Nodes.IsDistinctFrom(table.attribute('name'), null);
      const sql = compile(test);
      expect(sql).toContain('"users"."name" IS DISTINCT FROM NULL');
    });
  });

  describe('RETURNING', () => {
    it('insert statements render RETURNING', () => {
      const manager = new Arel.InsertManager();
      manager.into(table);
      manager.insert([[table.attribute('name'), 'hello']]);
      manager.returning(table.attribute('id'));
      expect(compile(manager.ast)).toContain('INSERT INTO "users" ("name") VALUES (\'hello\') RETURNING "users"."id"');
    });

    it('delete statements render RETURNING', () => {
      const manager = new Arel.DeleteManager();
      manager.from(table);
      manager.where(table.attribute('name').equal('hello'));
      manager.returning(table.attribute('id'));
      expect(compile(manager.ast)).toContain(
        'DELETE FROM "users" WHERE "users"."name" = \'hello\' RETURNING "users"."id"',
      );
    });

    it('update statements render RETURNING', () => {
      const manager = new Arel.UpdateManager();
      manager.table(table);
      manager.set([[table.attribute('name'), 'hello']]);
      manager.returning(table.attribute('id'));
      expect(compile(manager.ast)).toContain('UPDATE "users" SET "name" = \'hello\' RETURNING "users"."id"');
    });

    it.skip('update statements with joins render RETURNING', () => {
      // SKIP: needs PostgreSQL.visitUpdateStatement override that places JOINs in FROM clause
      // (Rails: UPDATE "users" SET "name" = 'hello' FROM CROSS JOIN "posts" RETURNING ...)
      const posts = new Arel.Table('posts');
      const joinSource = new Arel.Nodes.JoinSource(table, [table.createJoin(posts)]);
      const manager = new Arel.UpdateManager();
      manager.table(joinSource);
      manager.set([[table.attribute('name'), 'hello']]);
      manager.returning(table.attribute('id'));
      expect(compile(manager.ast)).toContain(
        'UPDATE "users" SET "name" = \'hello\' FROM CROSS JOIN "posts" RETURNING "users"."id"',
      );
    });
  });

  describe('Nodes.InfixOperation', () => {
    it('should handle Contains', () => {
      const inner = Arel.sql('{"foo":"bar"}');
      const outer = new Arel.Table('products').attribute('metadata');
      const sql = compile(new Arel.Nodes.Contains(outer, inner));
      expect(sql).toContain('"products"."metadata" @> \'{"foo":"bar"}\'');
    });

    it('should handle Overlaps', () => {
      const column = new Arel.Table('products').attribute('tags');
      const search = Arel.sql('{foo,bar,baz}');
      const sql = compile(new Arel.Nodes.Overlaps(column, search));
      expect(sql).toContain('"products"."tags" && \'{foo,bar,baz}\'');
    });
  });
});
