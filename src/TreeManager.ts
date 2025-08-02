import { Collectors } from './Collectors';
import { FactoryMethods } from './FactoryMethods';
import { Nodes } from './Nodes';
import { buildQuoted } from './utilities/nodes';
import { Visitors } from './Visitors';

type AstType = any | null;

export class TreeManager extends FactoryMethods {
  public ast: AstType;

  // toDot = () => {
  //   let collector = Collectors.PlainString();
  //   collector = Visitors.Dot().compile(this.ast, collector);
  //   return collector.value();
  // };

  toSql = () => {
    // collector = Arel::Collectors::SQLString.new
    // engine.with_connection do |connection|
    //   connection.visitor.accept(@ast, collector).value
    // end
    const collector = new Collectors.SqlString();
    return new Visitors.ToSql().accept(this.ast, collector).value();
  };
}

type LimitType = any;
type OffsetType = any;
type OrdersType = any[];
type WhereType = any;
type WheresType = WhereType[];

export class TreeManagerWithStatementMethods extends TreeManager {
  take = (limit: LimitType) => {
    if (limit != null) this.ast.limit = new Nodes.Limit(buildQuoted(limit));
    return this;
  };
  offset = (offset: OffsetType) => {
    if (offset != null) this.ast.offset = new Nodes.Offset(buildQuoted(offset));
    return this;
  };
  order = (...expressions: OrdersType) => {
    this.ast.orders = expressions;
    return this;
  };
  set key(key: string | string[]) {
    if (Array.isArray(key)) {
      this.ast.key = key.map((k) => buildQuoted(k));
    } else {
      this.ast.key = buildQuoted(key);
    }
  }
  get key() {
    return this.ast.key;
  }
  wheres = (expressions: WheresType) => {
    this.ast.wheres = expressions;
  };
  where = (expression: WhereType) => {
    this.ast.wheres.push(expression);
    return this;
  };
}
