import { AliasPredications } from './AliasPredication';
import { Attribute } from './Attribute';
import { FactoryMethods } from './FactoryMethods';
import { Nodes } from './Nodes';
import type { JoinType, TableAliasNode } from './Nodes/types';
import { SelectManager } from './SelectManager';
import { hash } from './utilities/hash';

type TableOptions = {
  as?: string | null;
  klass?: string;
  typeCaster?: unknown;
};

type EngineType = any;
type TypeCaster = any;

export class Table extends AliasPredications(FactoryMethods) {
  public name: string;
  public readonly tableAlias?: string;

  // todo
  private readonly klass?: string;
  private readonly typeCaster: TypeCaster;

  public static engine: EngineType | undefined;

  constructor(name: string, options?: TableOptions) {
    super();
    this.name = name;
    this.klass = options?.klass;
    this.typeCaster = options?.typeCaster;

    let as = options?.as ?? undefined;
    if (as === name) as = undefined;

    this.tableAlias = as;
  }

  alias = (name?: string) => new Nodes.TableAlias(this, name ?? `${this.name}_2`);
  from = () => new SelectManager(this);
  join = (relation: any, joinType?: JoinType) => this.from().join(relation, joinType);
  outerJoin = (relation: any) => this.join(relation, 'outer');
  group = (...columns: string[]) => this.from().group(...columns);
  order = (...columns: string[]) => this.from().order(...columns);
  where = (condition: any) => this.from().where(condition);
  project = (...things: any[]) => this.from().project(...things);
  take = (limit: number) => this.from().take(limit);
  skip = (offset: number) => this.from().skip(offset);
  having = (expression: any) => this.from().having(expression);
  attribute = (name: string, table: Table | TableAliasNode = this) => new Attribute(table, name);

  typeCastForDatabase = (attributeName: string, value: unknown) =>
    this.typeCaster?.typeCastForDatabase(attributeName, value);
  typeForAttribute = (attributeName: string) => this.typeCaster?.typeForAttribute(attributeName) ?? {};
  ableToTypeCast = () => this.typeCaster !== undefined;

  hash = () => hash(this.name);
}
