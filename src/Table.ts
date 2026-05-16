import { AliasPredications } from './AliasPredication';
import { Attribute, type TypeCaster } from './Attribute';
import { FactoryMethods } from './FactoryMethods';
import { Nodes } from './Nodes';
import type { SqlLiteralNode } from './Nodes/SqlLiteral';
import type { JoinType, TableAliasNode } from './Nodes/types';
import { SelectManager } from './SelectManager';
import type { Expression, Quotable, RelationLike } from './types';
import { hash } from './utilities/hash';

export type TableOptions = {
  as?: string | null;
  klass?: string;
  typeCaster?: TypeCaster;
};

type EngineType = unknown;

export class Table extends AliasPredications(FactoryMethods) {
  public name: string | SqlLiteralNode;
  public readonly tableAlias?: string;

  private readonly klass?: string;
  private readonly typeCaster?: TypeCaster;

  public static engine: EngineType | undefined;

  constructor(name: string | SqlLiteralNode, options?: TableOptions) {
    super();
    this.name = name;
    this.klass = options?.klass;
    this.typeCaster = options?.typeCaster;

    let as = options?.as ?? undefined;
    if (as === name) as = undefined;

    this.tableAlias = as;
  }

  alias = (name?: string): TableAliasNode => new Nodes.TableAlias(this, name ?? `${this.name}_2`);
  from = () => new SelectManager(this);
  join = (relation: RelationLike | string | null, joinType?: JoinType) => this.from().join(relation, joinType);
  outerJoin = (relation: RelationLike | string) => this.join(relation, 'outer');
  group = (...columns: Array<Expression | string>) => this.from().group(...columns);
  order = (...columns: Array<Expression | string>) => this.from().order(...columns);
  where = (condition: Expression | string) => this.from().where(condition);
  project = (...things: Array<Expression | string>) => this.from().project(...things);
  take = (limit: number) => this.from().take(limit);
  skip = (offset: number) => this.from().skip(offset);
  having = (expression: Expression) => this.from().having(expression);
  attribute = (name: string | SqlLiteralNode, table: Table | TableAliasNode = this) => new Attribute(table, name);

  quotedArray = (values: Quotable[]): Quotable[] => values;

  typeCastForDatabase = (attributeName: string, value: unknown): unknown =>
    this.typeCaster?.typeCastForDatabase?.(attributeName, value);
  typeForAttribute = (attributeName: string): unknown => this.typeCaster?.typeForAttribute?.(attributeName) ?? {};
  ableToTypeCast = (): boolean => this.typeCaster !== undefined;

  hash = () => hash(typeof this.name === 'string' ? this.name : this.name.toString());
}
