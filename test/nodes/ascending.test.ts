import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('Ascending', () => {
  it('constructs with expr', () => {
    const ascending = new Arel.Nodes.Ascending('zomg');
    expect(ascending.expression).toBe('zomg');
  });

  it('reverse returns Descending with same expr', () => {
    const ascending = new Arel.Nodes.Ascending('zomg');
    const descending = ascending.reverse();
    expect(descending).toBeInstanceOf(Arel.Nodes.Descending);
    expect(descending.expression).toBe(ascending.expression);
  });

  it('direction is asc', () => {
    const ascending = new Arel.Nodes.Ascending('zomg');
    expect(ascending.direction).toBe('asc');
  });

  it('ascending? returns true', () => {
    const ascending = new Arel.Nodes.Ascending('zomg');
    expect(ascending.isAscending()).toBe(true);
  });

  it('descending? returns false', () => {
    const ascending = new Arel.Nodes.Ascending('zomg');
    expect(ascending.isDescending()).toBe(false);
  });

  it('equality with same ivars', () => {
    const x = new Arel.Nodes.Ascending('zomg');
    const y = new Arel.Nodes.Ascending('zomg');
    expect(x.isEqual(y)).toBe(true);
  });

  it('inequality with different ivars', () => {
    const x = new Arel.Nodes.Ascending('zomg');
    const y = new Arel.Nodes.Ascending('zomg!');
    expect(x.isEqual(y)).toBe(false);
  });
});
