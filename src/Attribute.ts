import { AliasPredications } from './AliasPredication';
import { Expressions } from './Expressions';
import { MathOperations } from './Math';
import type { SqlLiteralNode } from './Nodes/SqlLiteral';
import type { TableAliasNode } from './Nodes/TableAlias';
import { OrderPredications } from './OrderPredications';
import { Predications } from './Predications';
import type { Table } from './Table';

/** Type-caster interface that adapters can implement. */
export type TypeCaster = {
  typeCastForDatabase?: (attributeName: string, value: unknown) => unknown;
  typeForAttribute?: (attributeName: string) => unknown;
};

/** Attribute names can be either a regular string column name or `Arel.star` (a SqlLiteral '*'). */
export type AttributeName = string | SqlLiteralNode;

export class Attribute extends MathOperations(OrderPredications(Predications(Expressions(AliasPredications(Object))))) {
  public relation: Table | TableAliasNode;
  public name: AttributeName;

  constructor(relation: Table | TableAliasNode, name: AttributeName) {
    super();
    this.relation = relation;
    this.name = name;
  }

  lower = () => (this.relation as Table).lower(this);
  typeCaster = () => (this.relation as Table).typeForAttribute(this.name as string);
  typeCastForDatabase = (value: unknown) => (this.relation as Table).typeCastForDatabase(this.name as string, value);
  ableToTypeCast = (): boolean => (this.relation as Table).ableToTypeCast();
}
