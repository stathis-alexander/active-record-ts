import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('boundSqlLiteral', () => {
  it('is equal with equal components', () => {
    const node1 = new Arel.Nodes.BoundSqlLiteral('foo + ?', [2], {});
    const node2 = new Arel.Nodes.BoundSqlLiteral('foo + ?', [2], {});

    expect(node1.isEqual(node2)).toBe(true);
  });

  it('is not equal with different components', () => {
    const node1 = new Arel.Nodes.BoundSqlLiteral('foo + ?', [2], {});
    const node2 = new Arel.Nodes.BoundSqlLiteral('foo + ?', [3], {});
    const node3 = new Arel.Nodes.BoundSqlLiteral('foo + :bar', [], { bar: 2 });

    expect(node1.isEqual(node2)).toBe(false);
    expect(node1.isEqual(node3)).toBe(false);
    expect(node2.isEqual(node3)).toBe(false);
  });
});
