import { beforeEach, describe, expect, it } from 'bun:test';
import Arel from '../../src';

const SelectStatement = Arel.Nodes.SelectStatement;
const UpdateStatement = Arel.Nodes.UpdateStatement;
const Offset = Arel.Nodes.Offset;
const Limit = Arel.Nodes.Limit;

describe('Visitors.MySQL', () => {
  let visitor: Arel.Visitors.MySQL;
  let table: Arel.Table;

  beforeEach(() => {
    visitor = new Arel.Visitors.MySQL();
    table = new Arel.Table('users');
  });

  function compile(node: unknown): string {
    return visitor.accept(node, new Arel.Collectors.SqlString()).value();
  }

  describe('limits and offsets', () => {
    // To retrieve all rows from a certain offset up to the end of the result set,
    // you can use some large number for the second parameter.
    // https://dev.mysql.com/doc/refman/en/select.html
    it('defaults limit to 18446744073709551615', () => {
      const stmt = new SelectStatement();
      stmt.offset = new Offset(1);
      const sql = compile(stmt);
      expect(sql).toContain('SELECT FROM DUAL LIMIT 18446744073709551615 OFFSET 1');
    });

    it('should escape LIMIT', () => {
      const sc = new UpdateStatement();
      sc.relation = table;
      sc.limit = new Limit(Arel.sql('omg'));
      expect(compile(sc)).toBe('UPDATE "users" LIMIT \'omg\'');
    });

    it('uses DUAL for empty from', () => {
      const stmt = new SelectStatement();
      const sql = compile(stmt);
      expect(sql).toContain('SELECT FROM DUAL');
    });
  });

  describe('locking', () => {
    it('defaults to FOR UPDATE when locking', () => {
      const node = new Arel.Nodes.Lock(Arel.sql('FOR UPDATE'));
      expect(compile(node)).toContain('FOR UPDATE');
    });

    it('allows a custom string to be used as a lock', () => {
      const node = new Arel.Nodes.Lock(Arel.sql('LOCK IN SHARE MODE'));
      expect(compile(node)).toContain('LOCK IN SHARE MODE');
    });
  });

  describe('concat', () => {
    it('concats columns', () => {
      const query = table.attribute('name').concat(table.attribute('name'));
      expect(compile(query)).toContain('CONCAT("users"."name", "users"."name")');
    });

    it('concats a string', () => {
      const query = table.attribute('name').concat(Arel.sql('abc'));
      expect(compile(query)).toContain('CONCAT("users"."name", \'abc\')');
    });
  });

  describe('Nodes.IsNotDistinctFrom', () => {
    it('should construct a valid generic SQL statement', () => {
      const test = table.attribute('name').isNotDistinctFrom('Aaron Patterson');
      expect(compile(test)).toContain('"users"."name" <=> \'Aaron Patterson\'');
    });

    it('should handle column names on both sides', () => {
      const test = table.attribute('first_name').isNotDistinctFrom(table.attribute('last_name'));
      expect(compile(test)).toContain('"users"."first_name" <=> "users"."last_name"');
    });

    it('should handle nil', () => {
      const test = new Arel.Nodes.IsNotDistinctFrom(table.attribute('name'), null);
      const sql = compile(test);
      expect(sql).toContain('"users"."name" <=> NULL');
    });
  });

  describe('Nodes.IsDistinctFrom', () => {
    it('should handle column names on both sides', () => {
      const test = table.attribute('first_name').isDistinctFrom(table.attribute('last_name'));
      expect(compile(test)).toContain('NOT "users"."first_name" <=> "users"."last_name"');
    });

    it('should handle nil', () => {
      const test = new Arel.Nodes.IsDistinctFrom(table.attribute('name'), null);
      const sql = compile(test);
      expect(sql).toContain('NOT "users"."name" <=> NULL');
    });
  });

  describe('Nodes.Regexp', () => {
    it('should know how to visit', () => {
      const node = table.attribute('name').matchesRegexp('foo.*');
      expect(node).toBeInstanceOf(Arel.Nodes.Regexp);
      expect(compile(node)).toContain('"users"."name" REGEXP \'foo.*\'');
    });

    it('can handle subqueries', () => {
      const subquery = table.project('id').where(table.attribute('name').matchesRegexp('foo.*'));
      const node = table.attribute('id').in(subquery);
      expect(compile(node)).toContain('"users"."id" IN (SELECT id FROM "users" WHERE "users"."name" REGEXP \'foo.*\')');
    });
  });

  describe('Nodes.NotRegexp', () => {
    it('should know how to visit', () => {
      const node = table.attribute('name').doesNotMatchRegexp('foo.*');
      expect(node).toBeInstanceOf(Arel.Nodes.NotRegexp);
      expect(compile(node)).toContain('"users"."name" NOT REGEXP \'foo.*\'');
    });

    it('can handle subqueries', () => {
      const subquery = table.project('id').where(table.attribute('name').doesNotMatchRegexp('foo.*'));
      const node = table.attribute('id').in(subquery);
      expect(compile(node)).toContain(
        '"users"."id" IN (SELECT id FROM "users" WHERE "users"."name" NOT REGEXP \'foo.*\')',
      );
    });
  });

  describe('Nodes.Ordering', () => {
    it('should handle nulls first', () => {
      const test = table.attribute('first_name').asc().nullsFirst();
      expect(compile(test)).toContain('"users"."first_name" IS NOT NULL, "users"."first_name" ASC');
    });

    it('should handle nulls last', () => {
      const test = table.attribute('first_name').asc().nullsLast();
      expect(compile(test)).toContain('"users"."first_name" IS NULL, "users"."first_name" ASC');
    });

    it('should handle nulls first reversed', () => {
      const test = table.attribute('first_name').asc().nullsFirst().reverse();
      expect(compile(test)).toContain('"users"."first_name" IS NULL, "users"."first_name" DESC');
    });

    it('should handle nulls last reversed', () => {
      const test = table.attribute('first_name').asc().nullsLast().reverse();
      expect(compile(test)).toContain('"users"."first_name" IS NOT NULL, "users"."first_name" DESC');
    });
  });

  describe('Nodes.Cte', () => {
    it('ignores MATERIALIZED modifiers', () => {
      const bar = new Arel.Table('bar');
      const cte = new Arel.Nodes.Cte('foo', bar.project(Arel.star), { materialized: true });
      expect(compile(cte)).toContain('"foo" AS (SELECT * FROM "bar")');
    });

    it('ignores NOT MATERIALIZED modifiers', () => {
      const bar = new Arel.Table('bar');
      const cte = new Arel.Nodes.Cte('foo', bar.project(Arel.star), { materialized: false });
      expect(compile(cte)).toContain('"foo" AS (SELECT * FROM "bar")');
    });
  });
});
