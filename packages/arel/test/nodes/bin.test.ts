import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

describe('Bin', () => {
  it('should create a new Bin node', () => {
    const bin = new Arel.Nodes.Bin(Arel.sql('zomg'));
    expect(bin).toBeInstanceOf(Arel.Nodes.Bin);
    expect(bin.value.toString()).toBe('zomg');
  });

  it('should default to SQL', () => {
    const viz = new Arel.Visitors.ToSql();
    const node = new Arel.Nodes.Bin(Arel.sql('zomg'));
    const result = viz.accept(node, new Arel.Collectors.SqlString());
    expect(result.value()).toBe('zomg');
  });

  it('should convert to MySQL SQL', () => {
    const viz = new Arel.Visitors.MySQL();
    const node = new Arel.Nodes.Bin(Arel.sql('zomg'));
    const result = viz.accept(node, new Arel.Collectors.SqlString());
    expect(result.value()).toBe('CAST(zomg AS BINARY)');
  });

  it('should consider bins with same value equal for uniqueness', () => {
    const x = new Arel.Nodes.Bin('zomg');
    const y = new Arel.Nodes.Bin('zomg');
    expect(x.isEqual(y)).toBe(true);
  });

  it('should consider bins with different values not equal for uniqueness', () => {
    const x = new Arel.Nodes.Bin('zomg');
    const y = new Arel.Nodes.Bin('zomg;');
    expect(x.isEqual(y)).toBe(false);
  });
});
