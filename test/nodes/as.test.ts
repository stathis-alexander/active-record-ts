import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('As', () => {
  it('makes an AS node', () => {
    const attr = new Arel.Table('users').attribute('id');
    const as = attr.as('foo');
    expect(as.left).toEqual(attr);
    expect(as.right.isEqual('foo')).toBe(true);
  });

  it('converts right to SqlLiteral if a string', () => {
    const attr = new Arel.Table('users').attribute('id');
    const as = attr.as('foo');
    expect(as.right).toBeInstanceOf(Arel.Nodes.SqlLiteral);
  });
});

describe('equality', () => {
  it('is equal with equal ivars', () => {
    const x = new Arel.Nodes.As('foo', 'bar');
    const y = new Arel.Nodes.As('foo', 'bar');
    expect(x.isEqual(y)).toBe(true);
  });

  it('is not equal with different ivars', () => {
    const x = new Arel.Nodes.As('foo', 'bar');
    const y = new Arel.Nodes.As('foo', 'baz');
    expect(x.isEqual(y)).toBe(false);
  });
});

describe('#to_cte', () => {
  it("returns a Cte node using the LHS's name and the RHS as the relation", () => {
    const table = new Arel.Table('users');
    const asNode = new Arel.Nodes.As(table, 'foo');
    const cteNode = asNode.toCte();

    expect(cteNode).toBeInstanceOf(Arel.Nodes.Cte);
    expect(asNode.left.name).toEqual(cteNode.name);
    expect(asNode.right).toEqual(cteNode.relation);
  });
});
