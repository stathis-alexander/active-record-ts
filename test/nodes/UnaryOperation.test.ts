import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('BitwiseNot', () => {
  it('constructs', () => {
    const operation = new Arel.Nodes.BitwiseNot(1);
    expect(operation.operator).toBe('~');
    expect(operation.expression).toBe(1);
  });

  it('operation alias', () => {
    const operation = new Arel.Nodes.BitwiseNot(1);
    const aliaz = operation.as('zomg');
    expect(aliaz).toBeInstanceOf(Arel.Nodes.As);
    expect(aliaz.left).toBe(operation);
    expect(aliaz.right.isEqual('zomg')).toBe(true);
  });

  it('operation ordering', () => {
    const operation = new Arel.Nodes.BitwiseNot(1);
    const ordering = operation.descending();
    expect(ordering).toBeInstanceOf(Arel.Nodes.Descending);
    expect(ordering.expression).toBe(operation);
    expect(ordering.isDescending()).toBe(true);
  });

  it('equality with same ivars', () => {
    const operation1 = new Arel.Nodes.BitwiseNot(1);
    const operation2 = new Arel.Nodes.BitwiseNot(1);

    expect(operation1.isEqual(operation2)).toBe(true);
  });

  it('inequality with different ivars', () => {
    const operation1 = new Arel.Nodes.BitwiseNot(1);
    const operation2 = new Arel.Nodes.BitwiseNot(2);

    expect(operation1.isEqual(operation2)).toBe(false);
  });
});
