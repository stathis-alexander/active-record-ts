import { beforeEach, describe, expect, it } from 'bun:test';
import Arel from '../../src';

const SelectStatement = Arel.Nodes.SelectStatement;
const Offset = Arel.Nodes.Offset;

describe('Visitors.SQLite', () => {
  let table: Arel.Table;

  beforeEach(() => {
    // Note: SQLite visitor implementation would be needed
    // visitor = new Arel.Visitors.SQLite();
    table = new Arel.Table('users');
  });

  function compile(node: any): string {
    // Note: This would need actual SQLite visitor implementation
    // return visitor.accept(node, new Arel.Collectors.SqlString()).value;
    return node.toString(); // Placeholder
  }

  it('defaults limit to -1', () => {
    const stmt = new SelectStatement();
    stmt.offset = new Offset(1);
    const sql = compile(stmt);
    expect(sql).toContain('SELECT LIMIT -1 OFFSET 1');
  });

  it('does not support locking', () => {
    const node = new Arel.Nodes.Lock(Arel.sql('FOR UPDATE'));
    expect(compile(node)).toBe('');
  });

  describe('Nodes.IsNotDistinctFrom', () => {
    it('should construct a valid generic SQL statement', () => {
      const test = table.attribute('name').isNotDistinctFrom('Aaron Patterson');
      expect(compile(test)).toContain('"users"."name" IS \'Aaron Patterson\'');
    });

    it('should handle column names on both sides', () => {
      const test = table.attribute('first_name').isNotDistinctFrom(table.attribute('last_name'));
      expect(compile(test)).toContain('"users"."first_name" IS "users"."last_name"');
    });

    it('should handle nil', () => {
      const test = new Arel.Nodes.IsNotDistinctFrom(table.attribute('name'), null);
      const sql = compile(test);
      expect(sql).toContain('"users"."name" IS NULL');
    });
  });

  describe('Nodes.IsDistinctFrom', () => {
    it('should handle column names on both sides', () => {
      const test = table.attribute('first_name').isDistinctFrom(table.attribute('last_name'));
      expect(compile(test)).toContain('"users"."first_name" IS NOT "users"."last_name"');
    });

    it('should handle nil', () => {
      const test = new Arel.Nodes.IsDistinctFrom(table.attribute('name'), null);
      const sql = compile(test);
      expect(sql).toContain('"users"."name" IS NOT NULL');
    });
  });
});
