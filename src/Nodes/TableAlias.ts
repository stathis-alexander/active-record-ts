import { Attribute } from '../Attribute';
import { Table } from '../Table';
import { BinaryNode, type LeftType, type RightType } from './Binary';
import { CteNode } from './Cte';

export class TableAliasNode extends BinaryNode {
  public name: RightType;
  public relation: LeftType;
  public tableAlias: RightType;

  constructor(left: LeftType, right: RightType) {
    super(left, right);
    this.name = right;
    this.relation = left;
    this.tableAlias = right;
  }

  attribute = (attributeName: string) => {
    if (this.relation instanceof Table) {
      return this.relation.attribute(attributeName, this);
    }
    return new Attribute(this, attributeName);
  };

  tableName = () => this.relation.name ?? this.name;
  typeCastForDatabase = (attributeName: string, value: unknown) =>
    this.relation.typeCastForDatabase(attributeName, value);
  typeForAttribute = (attributeName: string) => this.relation.typeForAttribute(attributeName);
  ableToTypeCast = () => this.relation.ableToTypeCast?.();
  toCte = () => new CteNode(this.name, this.relation);
}
