import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('SqlLiteral', () => {
  describe('sql', () => {
    it('makes a sql literal node', () => {
      const sql = Arel.sql('foo');
      expect(sql).toBeInstanceOf(Arel.Nodes.SqlLiteral);
    });
  });

  describe('count', () => {
    it('makes a count node', () => {
      const node = new Arel.Nodes.SqlLiteral('*').count();
      const sql = node.toSql();
      expect(sql).toMatch(/COUNT\(\*\)/i);
    });

    it('makes a distinct node', () => {
      const node = new Arel.Nodes.SqlLiteral('*').count(true);
      const sql = node.toSql();
      expect(sql).toMatch(/COUNT\(DISTINCT \*\)/i);
    });
  });

  describe('equality', () => {
    it('makes an equality node', () => {
      const node = new Arel.Nodes.SqlLiteral('foo').equal(1);
      const sql = node.toSql();
      expect(sql).toMatch(/foo\s*=\s*1/);
    });

    it('is equal with equal contents', () => {
      const literal1 = new Arel.Nodes.SqlLiteral('foo');
      const literal2 = new Arel.Nodes.SqlLiteral('foo');

      expect(literal1.isEqual(literal2)).toBe(true);
    });

    it('is not equal with different contents', () => {
      const literal1 = new Arel.Nodes.SqlLiteral('foo');
      const literal2 = new Arel.Nodes.SqlLiteral('bar');

      expect(literal1.isEqual(literal2)).toBe(false);
    });
  });

  describe('grouped "or" equality', () => {
    it('makes a grouping node with an or node', () => {
      const node = new Arel.Nodes.SqlLiteral('foo').equalAny([1, 2]);
      const sql = node.toSql();
      expect(sql).toMatch(/\(foo\s*=\s*1\s*OR\s*foo\s*=\s*2\)/i);
    });
  });

  describe('grouped "and" equality', () => {
    it('makes a grouping node with an and node', () => {
      const node = new Arel.Nodes.SqlLiteral('foo').equalAll([1, 2]);
      const sql = node.toSql();
      expect(sql).toMatch(/\(foo\s*=\s*1\s*AND\s*foo\s*=\s*2\)/i);
    });
  });

  describe('addition', () => {
    it('generates a Fragments node', () => {
      const sql1 = Arel.sql('SELECT *');
      const sql2 = Arel.sql('FROM users');
      const fragments = sql1.add(sql2);

      expect(fragments).toBeInstanceOf(Arel.Nodes.Fragments);
      if (fragments instanceof Arel.Nodes.Fragments) {
        expect(fragments.values).toEqual([sql1, sql2]);
      }
    });

    it('fails if joined with something that is not an Arel node', () => {
      const sql = Arel.sql('SELECT *');
      expect(() => {
        sql.add('Not a node');
      }).toThrow();
    });
  });
});
