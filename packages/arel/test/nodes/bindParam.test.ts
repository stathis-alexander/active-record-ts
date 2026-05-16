import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('bindParam', () => {
  it('is equal to other bind params with the same value', () => {
    expect(new Arel.Nodes.BindParam(1).isEqual(new Arel.Nodes.BindParam(1))).toBe(true);
    expect(new Arel.Nodes.BindParam('foo').isEqual(new Arel.Nodes.BindParam('foo'))).toBe(true);
  });

  it('is not equal to other nodes', () => {
    expect(new Arel.Nodes.BindParam(null).isEqual(new Arel.Nodes.Node())).toBe(false);
  });

  it('is not equal to bind params with different values', () => {
    expect(new Arel.Nodes.BindParam(1).isEqual(new Arel.Nodes.BindParam(2))).toBe(false);
  });
});
