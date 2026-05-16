import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('Node', () => {
  it('includes factory methods', () => {
    const node = new Arel.Nodes.Node();
    expect(typeof node.createJoin).toBe('function');
  });

  it('all nodes are nodes', () => {
    // This test verifies that all Node classes inherit from the base Node class
    // In TypeScript, this is enforced by the type system, but we can still test some key nodes
    const equality = new Arel.Nodes.Equality('test', 'test');
    const and = new Arel.Nodes.And(['test', 'test']);
    const or = new Arel.Nodes.Or(['test', 'test']);
    const not = new Arel.Nodes.Not('test');
    const trueNode = new Arel.Nodes.True();
    const falseNode = new Arel.Nodes.False();
    const ascending = new Arel.Nodes.Ascending('test');
    const descending = new Arel.Nodes.Descending('test');

    const instances = [equality, and, or, not, trueNode, falseNode, ascending, descending];

    instances.forEach((instance) => {
      expect(instance).toBeInstanceOf(Arel.Nodes.Node);
    });
  });
});
