import { describe, expect, it } from 'bun:test';
import Arel from '../../src';

class TypedNode extends Arel.Nodes.NamedFunction {
  public typeCaster: any;

  constructor(name: string, expr: any, type: any) {
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
