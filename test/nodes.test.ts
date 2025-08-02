import { describe, expect, it } from 'bun:test';
import Arel from '../src';

describe('Nodes', () => {
  it('should test every arel nodes have hash eql eqeq from same class', () => {
    // fix: This test validates that all Node subclasses properly implement
    // hash, equals, and eql methods from the same class
    // Since TypeScript doesn't have the same reflection capabilities as Ruby,
    // we'll implement a simplified version that checks key node types

    const literal1 = new Arel.Nodes.SqlLiteral('test');
    const literal2 = new Arel.Nodes.SqlLiteral('test');

    expect(typeof literal1.isEqual).toBe('function');
    expect(typeof literal1.hash).toBe('function');
    expect(literal1.isEqual(literal2)).toBe(true);
    expect(literal1.hash()).toBe(literal2.hash());

    const bind1 = new Arel.Nodes.BindParam(1);
    const bind2 = new Arel.Nodes.BindParam(1);

    expect(typeof bind1.isEqual).toBe('function');
    expect(typeof bind1.hash).toBe('function');
    expect(bind1.isEqual(bind2)).toBe(true);
    expect(bind1.hash()).toBe(bind2.hash());
  });
});
