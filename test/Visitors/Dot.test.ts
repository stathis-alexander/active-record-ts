import { beforeEach, describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('Dot', () => {
  let visitor: Arel.Dot;

  beforeEach(() => {
    visitor = new Arel.Visitors.Dot();
  });

  function assertEdge(edgeName: string, dotString: string) {
    const regex = new RegExp(`->.*label="${edgeName}"`);
    expect(dotString).toMatch(regex);
  }

  // Function nodes
  describe('function nodes', () => {
    it('should handle Sum', () => {
      const op = new Arel.Nodes.Sum('a');
      visitor.accept(op, new Arel.Collectors.PlainString());
    });

    it('should handle named function', () => {
      const func = new Arel.Nodes.NamedFunction('omg', ['omg']);
      visitor.accept(func, new Arel.Collectors.PlainString());
    });
  });

  // Unary operations
  describe('unary operations', () => {
    it('should handle Not', () => {
      const op = new Arel.Nodes.Not('a');
      visitor.accept(op, new Arel.Collectors.PlainString());
    });

    it('should handle Group', () => {
      const op = new Arel.Nodes.Group('a');
      visitor.accept(op, new Arel.Collectors.PlainString());
    });

    it('should handle Grouping', () => {
      const op = new Arel.Nodes.Grouping('a');
      visitor.accept(op, new Arel.Collectors.PlainString());
    });

    it('should handle UnqualifiedColumn', () => {
      const op = new Arel.Nodes.UnqualifiedColumn('a');
      visitor.accept(op, new Arel.Collectors.PlainString());
    });
  });

  // Binary operations
  describe('binary operations', () => {
    it('should handle Assignment', () => {
      const binary = new Arel.Nodes.Assignment('a', 'b');
      visitor.accept(binary, new Arel.Collectors.PlainString());
    });

    it('should handle Equality', () => {
      const binary = new Arel.Nodes.Equality('a', 'b');
      visitor.accept(binary, new Arel.Collectors.PlainString());
    });

    it('should handle In', () => {
      const binary = new Arel.Nodes.In('a', ['b']);
      visitor.accept(binary, new Arel.Collectors.PlainString());
    });

    it('should handle TableAlias', () => {
      const table = new Arel.Table('users');
      const binary = new Arel.Nodes.TableAlias(table, 'u');
      visitor.accept(binary, new Arel.Collectors.PlainString());
    });
  });

  // N-ary operations
  describe('n-ary operations', () => {
    it('should handle And', () => {
      const binary = new Arel.Nodes.And(['a', 'b']);
      visitor.accept(binary, new Arel.Collectors.PlainString());
    });

    it('should handle Or', () => {
      const binary = new Arel.Nodes.Or(['a', 'b']);
      visitor.accept(binary, new Arel.Collectors.PlainString());
    });
  });

  // Specific node tests
  it('should handle BindParam', () => {
    const node = new Arel.Nodes.BindParam(1);
    const collector = new Arel.Collectors.PlainString();
    const result = visitor.accept(node, collector);
    expect(result.value()).toMatch(/\[label="<f0>.*BindParam.*"\]/);
  });

  it('should handle Case and friends', () => {
    const foo = Arel.Nodes.buildQuoted('foo');
    const node = new Arel.Nodes.Case(foo);
    node.conditions = [new Arel.Nodes.When(foo, Arel.Nodes.buildQuoted(1))];
    node.default = new Arel.Nodes.Else(Arel.Nodes.buildQuoted(0));

    const dot = visitor.accept(node, new Arel.Collectors.PlainString()).value();

    expect(dot).toMatch(/\[label="<f0>.*Case.*"\]/);
    assertEdge('case', dot);
    assertEdge('conditions', dot);
    assertEdge('default', dot);
    expect(dot).toMatch(/\[label="<f0>.*When.*"\]/);
    expect(dot).toMatch(/\[label="<f0>.*Else.*"\]/);
  });

  it('should handle InfixOperation', () => {
    const node = new Arel.Nodes.InfixOperation('&&', Arel.Nodes.buildQuoted(1), Arel.Nodes.buildQuoted(2));

    const dot = visitor.accept(node, new Arel.Collectors.PlainString()).value();

    expect(dot).toMatch(/\[label="<f0>.*InfixOperation.*"\]/);
    assertEdge('operator', dot);
    assertEdge('left', dot);
    assertEdge('right', dot);
  });

  it('should handle RegExp', () => {
    const table = new Arel.Table('users');
    const node = new Arel.Nodes.Regexp(table.attribute('name'), Arel.Nodes.buildQuoted('foo%'));

    const dot = visitor.accept(node, new Arel.Collectors.PlainString()).value();

    expect(dot).toMatch(/\[label="<f0>.*Regexp.*"\]/);
    assertEdge('left', dot);
    assertEdge('right', dot);
    assertEdge('case_sensitive', dot);
  });

  it('should handle UnaryOperation', () => {
    const node = new Arel.Nodes.UnaryOperation('-', 1);

    const dot = visitor.accept(node, new Arel.Collectors.PlainString()).value();

    expect(dot).toMatch(/\[label="<f0>.*UnaryOperation.*"\]/);
    assertEdge('operator', dot);
    assertEdge('expr', dot);
  });

  it('should handle With', () => {
    const node = new Arel.Nodes.With(['query1', 'query2', 'query3']);

    const dot = visitor.accept(node, new Arel.Collectors.PlainString()).value();

    expect(dot).toMatch(/\[label="<f0>.*With.*"\]/);
    assertEdge('0', dot);
    assertEdge('1', dot);
    assertEdge('2', dot);
  });

  it('should handle SelectCore', () => {
    const node = new Arel.Nodes.SelectCore();

    const dot = visitor.accept(node, new Arel.Collectors.PlainString()).value();

    expect(dot).toMatch(/\[label="<f0>.*SelectCore.*"\]/);
    assertEdge('source', dot);
    assertEdge('projections', dot);
    assertEdge('wheres', dot);
    assertEdge('groups', dot);
    assertEdge('havings', dot);
  });

  it('should handle SelectStatement', () => {
    const node = new Arel.Nodes.SelectStatement();

    const dot = visitor.accept(node, new Arel.Collectors.PlainString()).value();

    expect(dot).toMatch(/\[label="<f0>.*SelectStatement.*"\]/);
    assertEdge('cores', dot);
    assertEdge('limit', dot);
    assertEdge('orders', dot);
    assertEdge('offset', dot);
  });

  it('should handle InsertStatement', () => {
    const node = new Arel.Nodes.InsertStatement();

    const dot = visitor.accept(node, new Arel.Collectors.PlainString()).value();

    expect(dot).toMatch(/\[label="<f0>.*InsertStatement.*"\]/);
    assertEdge('relation', dot);
    assertEdge('columns', dot);
    assertEdge('values', dot);
  });

  it('should handle UpdateStatement', () => {
    const node = new Arel.Nodes.UpdateStatement();

    const dot = visitor.accept(node, new Arel.Collectors.PlainString()).value();

    expect(dot).toMatch(/\[label="<f0>.*UpdateStatement.*"\]/);
    assertEdge('relation', dot);
    assertEdge('wheres', dot);
    assertEdge('values', dot);
    assertEdge('orders', dot);
    assertEdge('limit', dot);
    assertEdge('key', dot);
  });

  it('should handle DeleteStatement', () => {
    const node = new Arel.Nodes.DeleteStatement();

    const dot = visitor.accept(node, new Arel.Collectors.PlainString()).value();

    expect(dot).toMatch(/\[label="<f0>.*DeleteStatement.*"\]/);
    assertEdge('relation', dot);
    assertEdge('wheres', dot);
    assertEdge('orders', dot);
    assertEdge('limit', dot);
    assertEdge('key', dot);
  });
});
