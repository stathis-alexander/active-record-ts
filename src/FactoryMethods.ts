import { Nodes } from './Nodes';
import type { Expression, JoinType } from './types';
import { buildQuoted, Join } from './utilities/nodes';

export class FactoryMethods {
  createTrue = () => new Nodes.True();
  createFalse = () => new Nodes.False();
  createTableAlias = (relation: Expression, name: string) => new Nodes.TableAlias(relation, name);
  createJoin = (to: Expression, constraint?: Expression, joinType: JoinType = 'inner') => {
    const joinNodeClass = Join(joinType);
    return new joinNodeClass(to, constraint);
  };
  createStringJoin = (to: Expression) => new Nodes.StringJoin(to, undefined);
  createInsert = () => {
    // Lazy require avoids a circular import: InsertManager -> TreeManager -> FactoryMethods.
    const { InsertManager } = require('./InsertManager') as typeof import('./InsertManager');
    return new InsertManager();
  };
  createAnd = (clauses: Expression[]) => new Nodes.And(clauses);
  createOn = (expr: Expression) => new Nodes.On(expr);
  grouping = (expr: Expression) => new Nodes.Grouping(expr);
  lower = (column: Expression) => new Nodes.NamedFunction('LOWER', [buildQuoted(column)]);
  coalesce = (...expressions: Expression[]) => new Nodes.NamedFunction('COALESCE', expressions);
  cast = (name: Expression, type: string) => new Nodes.NamedFunction('CAST', [new Nodes.As(name, type)]);
}
