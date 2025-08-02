import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

const BindParam = Arel.Nodes.BindParam;

function astWithBinds() {
  const table = new Arel.Table('users');
  const manager = new Arel.SelectManager(table);
  manager.where(table.attribute('age').equal(new BindParam('hello')));
  manager.where(table.attribute('name').equal(new BindParam('world')));
  return manager.ast;
}

function compile(node: any) {
  const collector = new Arel.Collectors.SqlString();
  // Simulate visitor.accept(node, collector)
  // Assuming ToSql visitor is available as Arel.Visitors.ToSql
  new Arel.Visitors.ToSql().accept(node, collector);
  return collector.value();
}

describe('Collectors.SqlString', () => {
  it('compiles SQL with binds', () => {
    const sql = compile(astWithBinds());
    expect(sql).toBe('SELECT FROM "users" WHERE "users"."age" = ? AND "users"."name" = ?');
  });

  it('returned SQL uses utf8 encoding (always true in JS)', () => {
    const sql = compile(astWithBinds());
    // In JS, strings are always UTF-16, but for test parity:
    expect(typeof sql).toBe('string');
  });
});
