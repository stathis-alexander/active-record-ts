import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('Descending', () => {
  it('constructs with expr', () => {
    const descending = new Arel.Nodes.Descending('zomg');
    expect(descending.expression).toBe('zomg');
  });

  it('reverse returns Ascending with same expr', () => {
    const descending = new Arel.Nodes.Descending('zomg');
    const ascending = descending.reverse();
    expect(ascending).toBeInstanceOf(Arel.Nodes.Ascending);
    expect(ascending.expression).toBe(descending.expression);
  });

  it('direction is desc', () => {
    const descending = new Arel.Nodes.Descending('zomg');
    expect(descending.direction).toBe('desc');
  });

  it('ascending? returns false', () => {
    const descending = new Arel.Nodes.Descending('zomg');
    expect(descending.isAscending()).toBe(false);
  });

  it('descending? returns true', () => {
    const descending = new Arel.Nodes.Descending('zomg');
    expect(descending.isDescending()).toBe(true);
  });

  it('equality with same ivars', () => {
    const desc1 = new Arel.Nodes.Descending('zomg');
    const desc2 = new Arel.Nodes.Descending('zomg');
    expect(desc1.isEqual(desc2)).toBe(true);
  });

  it('inequality with different ivars', () => {
    const desc1 = new Arel.Nodes.Descending('zomg');
    const desc2 = new Arel.Nodes.Descending('zomg!');
    expect(desc1.isEqual(desc2)).toBe(false);
  });
});
