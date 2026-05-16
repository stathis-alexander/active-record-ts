import { describe, expect, it } from 'bun:test';
import type { Expression } from '../../src';
import Arel from '../../src';

/**
 * Shape that `HomogeneousIn.castedValues()` consults — a no-arg function that
 * returns the type used to serialize bind values. Tests pass `String` here
 * (Ruby-style: the class object stands in for the type).
 */
type TypeCaster = () => unknown;

class TypedNode extends Arel.Nodes.NamedFunction {
  public typeCaster: TypeCaster;

  constructor(name: string, expr: Expression | Expression[], type: TypeCaster) {
    super(name, expr);
    this.typeCaster = type;
  }
}

const FakePgCaster = {
  typeForAttribute: (_attrName: string) => String,
};

describe('HomogeneousIn', () => {
  it('creates IN expression', () => {
    const table = new Arel.Table('users', { typeCaster: FakePgCaster });
    const expr = new Arel.Nodes.HomogeneousIn(['Bobby', 'Robert'], table.attribute('name'), 'in');
    const sql = expr.toSql();

    expect(sql).toMatch(/"users"\."name" IN \(\?, \?\)/i);
  });

  it('works with custom attribute node', () => {
    const table = new Arel.Table('users');
    const node = new TypedNode('COALESCE', [table.attribute('nickname'), table.attribute('name')], String);
    const expr = new Arel.Nodes.HomogeneousIn(['Bobby', 'Robert'], node, 'in');
    const sql = expr.toSql();

    expect(sql).toMatch(/COALESCE\("users"\."nickname", "users"\."name"\) IN \(*\?, *\?\)/i);
  });
});
