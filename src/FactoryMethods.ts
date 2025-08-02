import { Nodes } from './Nodes';
import type { JoinType } from './Nodes/types';
import { buildQuoted, Join } from './utilities/nodes';

export class FactoryMethods {
  createTrue = () => new Nodes.True();
  createFalse = () => new Nodes.False();
  createTableAlias = (relation: any, name: string) => new Nodes.TableAlias(relation, name);
  createJoin = (to: any, constraint: any, joinType: JoinType = 'inner') => {
    const joinNodeClass = Join(joinType);
    return new joinNodeClass(to, constraint);
  };
  createStringJoin = (to: any) => new Nodes.StringJoin(to, undefined);
  createAnd = (clauses: any[]) => new Nodes.And(clauses);
  createOn = (expr: any) => new Nodes.On(expr);
  grouping = (expr: any) => new Nodes.Grouping(expr);
  lower = (column: string) => new Nodes.NamedFunction('LOWER', [buildQuoted(column)]);
  coalesce = (...expressions: any[]) => new Nodes.NamedFunction('COALESCE', expressions);
  cast = (name: any, type: string) => new Nodes.NamedFunction('CAST', [name.as(type)]);
}
