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

function compile(node: unknown) {
  const collector = new Arel.Collectors.Bind();
  new Arel.Visitors.ToSql().accept(node, collector);
  return collector.value();
}

describe('Collectors.Bind', () => {
  it('gathers all bind params', () => {
    let binds = compile(astWithBinds(['hello', 'world']));
    expect(binds).toEqual(['hello', 'world']);

    binds = compile(astWithBinds(['hello2', 'world3']));
    expect(binds).toEqual(['hello2', 'world3']);
  });
});
