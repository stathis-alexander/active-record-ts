import { Attribute } from '../Attribute';
import { Table } from '../Table';
import type { Expression, RelationLike } from '../types';
import { BinaryNode } from './Binary';
import { CteNode } from './Cte';
import type { SqlLiteralNode } from './SqlLiteral';

/** What can be used as the relation a TableAlias wraps. */
type AliasableRelation = RelationLike | Expression;
/** What can be the alias name (a primitive string or a SqlLiteral wrapper). */
type AliasName = string | SqlLiteralNode;

export class TableAliasNode extends BinaryNode {
  public name: AliasName;
  public relation: AliasableRelation;
  public tableAlias: AliasName;

  constructor(left: AliasableRelation, right: AliasName) {
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

  tableName = (): string | undefined => {
    const rel = this.relation as { name?: string };
    if (rel && typeof rel.name === 'string') return rel.name;
    return typeof this.name === 'string' ? this.name : this.name.toString();
  };
  typeCastForDatabase = (attributeName: string, value: unknown) => {
    const rel = this.relation as { typeCastForDatabase?: (n: string, v: unknown) => unknown };
    return rel.typeCastForDatabase?.(attributeName, value);
  };
  typeForAttribute = (attributeName: string) => {
    const rel = this.relation as { typeForAttribute?: (n: string) => unknown };
    return rel.typeForAttribute?.(attributeName);
  };
  ableToTypeCast = () => {
    const rel = this.relation as { ableToTypeCast?: () => boolean };
    return rel.ableToTypeCast?.();
  };
  toCte = () =>
    new CteNode(typeof this.name === 'string' ? this.name : this.name.toString(), this.relation as RelationLike);
}
