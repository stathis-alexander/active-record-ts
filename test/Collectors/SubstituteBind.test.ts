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

function compile(node: unknown, quoter: { quote: (val: unknown) => string }) {
  const collector = new Arel.Collectors.SubstituteBind(quoter, new Arel.Collectors.SqlString());
  // Simulate visitor.accept(node, collector).value
  // Assuming ToSql visitor is available as Arel.Visitors.ToSql
  return new Arel.Visitors.ToSql().accept(node, collector).value();
}

describe('Collectors.SubstituteBind', () => {
  it('compiles with default quoter', () => {
    const quoter = { quote: (val: unknown) => String(val) };
    const sql = compile(astWithBinds(), quoter);
    expect(sql).toBe('SELECT FROM "users" WHERE "users"."age" = hello AND "users"."name" = world');
  });

  it('delegates quoting to quoter', () => {
    const quoter = { quote: (val: unknown) => JSON.stringify(val) };
    const sql = compile(astWithBinds(), quoter);
    expect(sql).toBe('SELECT FROM "users" WHERE "users"."age" = "hello" AND "users"."name" = "world"');
  });
});
