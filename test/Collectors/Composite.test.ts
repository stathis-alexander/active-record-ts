import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

const BindParam = Arel.Nodes.BindParam;

function astWithBinds(bvs: string[]) {
  const table = new Arel.Table('users');
  const manager = new Arel.SelectManager(table);
  manager.where(table.attribute('age').equal(new BindParam(bvs.shift())));
  manager.where(table.attribute('name').equal(new BindParam(bvs.shift())));
  return manager.ast;
}

function compile(node: any) {
  const sqlCollector = new Arel.Collectors.SqlString();
  const bindCollector = new Arel.Collectors.Bind();
  const collector = new Arel.Collectors.Composite(sqlCollector, bindCollector);
  // Simulate visitor.accept(node, collector)
  // Assuming ToSql visitor is available as Arel.Visitors.ToSql
  new Arel.Visitors.ToSql().accept(node, collector);
  return [sqlCollector.value(), bindCollector.value()];
}

describe('Collectors.Composite', () => {
  it('performs multiple collections at once', () => {
    let [sql, binds] = compile(astWithBinds(['hello', 'world']));
    expect(sql).toBe('SELECT FROM "users" WHERE "users"."age" = ? AND "users"."name" = ?');
    expect(binds).toEqual(['hello', 'world']);

    [sql, binds] = compile(astWithBinds(['hello2', 'world3']));
    expect(sql).toBe('SELECT FROM "users" WHERE "users"."age" = ? AND "users"."name" = ?');
    expect(binds).toEqual(['hello2', 'world3']);
  });

  it('propagates retryable on composite collector', () => {
    const sqlCollector = new Arel.Collectors.SqlString();
    const bindCollector = new Arel.Collectors.Bind();
    const collector = new Arel.Collectors.Composite(sqlCollector, bindCollector);
    collector.retryable = true;
    expect(sqlCollector.retryable).toBe(true);
    expect(bindCollector.retryable).toBe(true);
  });
});
