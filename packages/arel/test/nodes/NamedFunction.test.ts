import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('NamedFunction', () => {
  it('constructs with name and expressions', () => {
    const func = new Arel.Nodes.NamedFunction('omg', 'zomg');
    expect(func.name).toBe('omg');
    expect(func.expressions).toBe('zomg');
  });

  it('equality with same ivars', () => {
    const func1 = new Arel.Nodes.NamedFunction('omg', 'zomg');
    const func2 = new Arel.Nodes.NamedFunction('omg', 'zomg');

    expect(func1.isEqual(func2)).toBe(true);
  });

  it('inequality with different ivars', () => {
    const func1 = new Arel.Nodes.NamedFunction('omg', 'zomg');
    const func2 = new Arel.Nodes.NamedFunction('zomg', 'zomg');

    expect(func1.isEqual(func2)).toBe(false);
  });
});
