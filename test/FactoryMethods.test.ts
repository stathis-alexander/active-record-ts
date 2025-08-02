import { beforeEach, describe, expect, it } from 'bun:test';
import Arel from '../src';
import { FactoryMethods } from '../src/FactoryMethods';

class Factory extends FactoryMethods {}

describe('FactoryMethods', () => {
  let factory: Factory;

  beforeEach(() => {
    factory = new Factory();
  });

  it('test_create_join', () => {
    const join = factory.createJoin('one', 'two');
    expect(join).toBeInstanceOf(Arel.Nodes.InnerJoin);
    expect(join.right).toBe('two');
  });

  it('test_create_table_alias', () => {
    const tableAlias = factory.createTableAlias('one', 'two');
    expect(tableAlias).toBeInstanceOf(Arel.Nodes.TableAlias);
    expect(tableAlias.right).toBe('two');
  });

  it('test_create_and', () => {
    const andNode = factory.createAnd(['foo', 'bar']);
    expect(andNode).toBeInstanceOf(Arel.Nodes.And);
    expect(andNode.children).toEqual(['foo', 'bar']);
  });

  it('test_create_string_join', () => {
    const join = factory.createStringJoin('foo');
    expect(join).toBeInstanceOf(Arel.Nodes.StringJoin);
    expect(join.left).toBe('foo');
  });

  it('test_grouping', () => {
    const grouping = factory.grouping('one');
    expect(grouping).toBeInstanceOf(Arel.Nodes.Grouping);
    expect(grouping.expression).toBe('one');
  });

  it('test_create_on', () => {
    const on = factory.createOn('one');
    expect(on).toBeInstanceOf(Arel.Nodes.On);
    expect(on.expression).toBe('one');
  });

  it('test_create_true', () => {
    const trueNode = factory.createTrue();
    expect(trueNode).toBeInstanceOf(Arel.Nodes.True);
  });

  it('test_create_false', () => {
    const falseNode = factory.createFalse();
    expect(falseNode).toBeInstanceOf(Arel.Nodes.False);
  });

  it('test_lower', () => {
    const lower = factory.lower('one');
    expect(lower).toBeInstanceOf(Arel.Nodes.NamedFunction);
    expect(lower.name).toBe('LOWER');
    expect(lower.expressions.map((e: any) => e.expr)).toEqual(['one']);
  });

  it('test_coalesce', () => {
    const relation = new Arel.Table('users');
    const fieldNode = relation.attribute('active');
    const coalesce = factory.coalesce(fieldNode, 0);
    expect(coalesce).toBeInstanceOf(Arel.Nodes.NamedFunction);
    expect(coalesce.name).toBe('COALESCE');
    expect(coalesce.expressions).toEqual([fieldNode, 0]);
  });

  it('test_cast', () => {
    const relation = new Arel.Table('users');
    const fieldNode = relation.attribute('active');
    const cast = factory.cast(fieldNode, 'boolean');
    expect(cast).toBeInstanceOf(Arel.Nodes.NamedFunction);
    expect(cast.name).toBe('CAST');
    const asNode = cast.expressions[0];
    expect(asNode).toBeInstanceOf(Arel.Nodes.As);
    expect(asNode.left).toBe(fieldNode);
    expect(asNode.right).toBe('boolean');
  });
});
