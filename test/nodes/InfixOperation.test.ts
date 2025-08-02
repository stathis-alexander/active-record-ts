import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('InfixOperation', () => {
  it('construct', () => {
    const operation = new Arel.Nodes.InfixOperation('+', 1, 2);
    expect(operation.operator).toBe('+');
    expect(operation.left).toBe(1);
    expect(operation.right).toBe(2);
  });

  it('operation alias', () => {
    const operation = new Arel.Nodes.InfixOperation('+', 1, 2);
    const aliaz = operation.as('zomg');
    expect(aliaz).toBeInstanceOf(Arel.Nodes.As);
    expect(aliaz.left).toBe(operation);
    expect(aliaz.right.isEqual('zomg')).toBe(true);
  });

  it('operation ordering', () => {
    const operation = new Arel.Nodes.InfixOperation('+', 1, 2);
    const ordering = operation.descending();
    expect(ordering).toBeInstanceOf(Arel.Nodes.Descending);
    expect(ordering.expression).toBe(operation);
    expect(ordering.isDescending()).toBe(true);
  });

  it('equality with same ivars', () => {
    const op1 = new Arel.Nodes.InfixOperation('+', 1, 2);
    const op2 = new Arel.Nodes.InfixOperation('+', 1, 2);
    expect(op1.isEqual(op2)).toBe(true);
  });

  it('inequality with different ivars', () => {
    const op1 = new Arel.Nodes.InfixOperation('+', 1, 2);
    const op2 = new Arel.Nodes.InfixOperation('+', 1, 3);
    expect(op1.isEqual(op2)).toBe(false);
  });
});
