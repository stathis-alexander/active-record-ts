import type { Attribute } from '../Attribute';
import { Collectors } from '../Collectors';
import type { SqlString } from '../Collectors/SqlString';
import { Nodes } from '../Nodes';
import type { SelectManager } from '../SelectManager';
import type { Table } from '../Table';
import type {
  AndNode,
  AscendingNode,
  AsNode,
  AverageNode,
  BinNode,
  CastedNode,
  CountNode,
  EqualityNode,
  ExtractNode,
  FilterNode,
  FullOuterJoinNode,
  FunctionNode,
  GreaterThanNode,
  GroupingNode,
  GroupNode,
  HomogeneousInNode,
  InequalityNode,
  InfixOperationNode,
  InNode,
  InnerJoinNode,
  JoinSourceNode,
  LimitNode,
  MatchesNode,
  MaximumNode,
  MinimumNode,
  NamedWindowNode,
  Node,
  OffsetNode,
  OnNode,
  OrNode,
  OuterJoinNode,
  OverNode,
  QuotedNode,
  RightOuterJoinNode,
  Scalar,
  SelectCoreNode,
  SelectStatementNode,
  SqlLiteralNode,
  StringJoinNode,
  SumNode,
  TableAliasNode,
  UnionAllNode,
  UnionNode,
  WindowNode,
} from '../types';
import { isNull } from '../utilities/nodes';
import { Visitor } from './Visitor';

const quoteIdentifier = (name: string): string => `\"${name.replaceAll('"', '')}\"`;
const quoteTableName = (name: string): string => {
  const [schema, table, ...rest] = name.split('.');
  if (!schema || rest.length > 0) throw new Error(`Invalid table name: ${name}`);
  // No schema provided, whole name is a table.
  if (!table) return quoteIdentifier(schema);

  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
};

// https://github.com/rails/rails/blob/main/activerecord/lib/active_record/connection_adapters/abstract/quoting.rb#L72
// def quote(value)
//   case value
//   when String, Symbol, ActiveSupport::Multibyte::Chars
//     "'#{quote_string(value.to_s)}'"
//   when true       then quoted_true
//   when false      then quoted_false
//   when nil        then "NULL"
//   # BigDecimals need to be put in a non-normalized form and quoted.
//   when BigDecimal then value.to_s("F")
//   when Numeric then value.to_s
//   when Type::Binary::Data then quoted_binary(value)
//   when Type::Time::Value then "'#{quoted_time(value)}'"
//   when Date, Time then "'#{quoted_date(value)}'"
//   when Class      then "'#{value}'"
//   else
//     raise TypeError, "can't quote #{value.class.name}"
//   end
// end
const quoteValue = (value: Scalar): string => {
  if (value == null) return 'NULL';
  if (typeof value === 'string') return `'${(value as string).replaceAll('\\', '').replaceAll("'", '')}'`;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return (value as number).toString();

  // likely need to tweak this
  if (value instanceof Date) return `'${value.toISOString()}'`;

  throw new Error(`can't quote ${typeof value}: ${value}`);
};

type ConnectionType = any;

export class ToSql extends Visitor {
  private readonly connection: ConnectionType;
  private static readonly bindFunction = () => '?';

  constructor(connection?: ConnectionType) {
    super();
    this.connection = connection;
  }

  compile(node: Node, collector: SqlString = new Collectors.SqlString()) {
    return this.visit(node, collector).value();
  }

  protected visitAnd(node: AndNode, collector: SqlString) {
    return this.injectJoin(node.children, collector, ' AND ');
  }

  protected visitArray(node: Node[], collector: SqlString) {
    return this.injectJoin(node, collector, ', ');
  }

  protected visitAs(node: AsNode, collector: SqlString) {
    collector = this.visit(node.left, collector);
    collector.collect(' AS ');
    return this.visit(node.right, collector);
  }

  protected visitAscending(node: AscendingNode, collector: SqlString) {
    return this.visit(node.expression, collector).collect(' ASC');
  }

  protected visitAttribute = (node: Attribute, collector: SqlString) => {
    const { relation, name } = node;

    return collector
      .collect(quoteTableName(relation.tableAlias ?? relation.name))
      .collect('.')
      .collect(quoteIdentifier(name));
  };

  protected visitAverage(node: AverageNode, collector: SqlString) {
    return this.aggregate('AVG', node, collector);
  }

  protected visitBin(node: BinNode, collector: SqlString) {
    return this.visit(node.expression, collector);
  }

  protected visitCasted = (node: CastedNode, collector: SqlString) => {
    return collector.collect(quoteValue(node.valueForDatabase()));
  };

  protected visitCount(node: CountNode, collector: SqlString) {
    return this.aggregate('COUNT', node, collector);
  }

  protected visitDescending(node: AscendingNode, collector: SqlString) {
    return this.visit(node.expression, collector).collect(' DESC');
  }

  protected visitDoesNotMatch(node: MatchesNode, collector: SqlString) {
    collector = this.visit(node.left, collector);
    collector.collect(' NOT LIKE ');
    collector = this.visit(node.right, collector);
    if (node.escape) {
      collector.collect(' ESCAPE ');
      collector = this.visit(node.escape, collector);
    }
    return collector;
  }

  protected visitEquality(node: EqualityNode, collector: SqlString) {
    const { right, left } = node;

    // handle unboundable

    collector = this.visit(left, collector);

    if (isNull(right)) return collector.collect(' IS NULL');

    collector.collect(' = ');
    return this.visit(right, collector);
  }

  protected visitExtract(node: ExtractNode, collector: SqlString) {
    collector.collect('EXTRACT(');
    collector.collect(node.field.toString().toUpperCase());
    collector.collect(' FROM ');
    this.visit(node.expression, collector);
    collector.collect(')');

    return collector;
  }

  protected visitFilter(node: FilterNode, collector: SqlString) {
    collector = this.visit(node.left, collector);
    collector.collect(' FILTER (WHERE ');
    collector = this.visit(node.right, collector);
    collector.collect(')');
    return collector;
  }

  protected visitFullOuterJoin(node: FullOuterJoinNode, collector: SqlString) {
    collector.collect('FULL OUTER JOIN ');
    collector = this.visit(node.left, collector);
    collector.collect(' ');
    return this.visit(node.right, collector);
  }

  protected visitHomogeneousIn(node: HomogeneousInNode, collector: SqlString) {
    collector.preparable = false;
    this.visit(node.left, collector);

    if (node.type === 'in') {
      collector.collect(' IN (');
    } else {
      collector.collect(' NOT IN (');
    }

    const values = node.castedValues();

    if (values.length === 0) {
      collector.collect('NULL');
    } else {
      collector.addBinds(values, node.procForBinds(), ToSql.bindFunction);
    }

    return collector.collect(')');
  }

  protected visitIn(node: InNode, collector: SqlString) {
    const { left: attr, right: values } = node;

    if (Array.isArray(values)) {
      collector.preparable = false;

      if (values.length === 0) return collector.collect('1=0');

      values.forEach((_value) => {
        // delete value if it's unboundable
      });
    }

    this.visit(attr, collector);
    collector.collect(' IN (');
    this.visit(values, collector);
    collector.collect(')');

    return collector;
  }

  protected visitInequality(node: InequalityNode, collector: SqlString) {
    const { right, left } = node;

    // handle unboundable

    collector = this.visit(left, collector);

    if (isNull(right)) return collector.collect(' IS NOT NULL');

    collector.collect(' != ');
    return this.visit(right, collector);
  }

  protected visitInfixOperation(node: InfixOperationNode<string>, collector: SqlString) {
    collector = this.visit(node.left, collector);
    collector.collect(` ${node.operator} `);
    return this.visit(node.right, collector);
  }

  protected visitInnerJoin(node: InnerJoinNode, collector: SqlString) {
    collector.collect('INNER JOIN ');
    collector = this.visit(node.left, collector);
    if (node.right) {
      collector.collect(' ');
      return this.visit(node.right, collector);
    }

    return collector;
  }

  protected visitGreaterThan(node: GreaterThanNode, collector: SqlString) {
    // handle unboundable

    this.visit(node.left, collector);
    collector.collect(' > ');
    return this.visit(node.right, collector);
  }

  protected visitGreaterThanOrEqual(node: GreaterThanNode, collector: SqlString) {
    // handle unboundable

    this.visit(node.left, collector);
    collector.collect(' >= ');
    return this.visit(node.right, collector);
  }

  protected visitGroup(node: GroupNode, collector: SqlString) {
    return this.visit(node.expression, collector);
  }

  protected visitGrouping(node: GroupingNode, collector: SqlString) {
    if (node.expression instanceof Nodes.Grouping) {
      this.visit(node.expression, collector);
    } else {
      collector.collect('(');
      this.visit(node.expression, collector);
      collector.collect(')');
    }

    return collector;
  }

  protected visitJoinSource(node: JoinSourceNode, collector: SqlString) {
    if (node.left) collector = this.visit(node.left, collector);

    if (node.right.length > 0) {
      if (node.left) collector.collect(' ');
      collector = this.injectJoin(node.right, collector, ' ');
    }

    return collector;
  }

  protected visitLessThan(node: GreaterThanNode, collector: SqlString) {
    // handle unboundable

    this.visit(node.left, collector);
    collector.collect(' < ');
    return this.visit(node.right, collector);
  }

  protected visitLessThanOrEqual(node: GreaterThanNode, collector: SqlString) {
    // handle unboundable

    this.visit(node.left, collector);
    collector.collect(' <= ');
    return this.visit(node.right, collector);
  }

  protected visitLimit(node: LimitNode, collector: SqlString) {
    collector.collect('LIMIT ');
    return this.visit(node.expression, collector);
  }

  protected visitMatches(node: MatchesNode, collector: SqlString) {
    collector = this.visit(node.left, collector);
    collector.collect(' LIKE ');
    collector = this.visit(node.right, collector);
    if (node.escape) {
      collector.collect(' ESCAPE ');
      collector = this.visit(node.escape, collector);
    }
    return collector;
  }

  protected visitMaximum(node: MaximumNode, collector: SqlString) {
    return this.aggregate('MAX', node, collector);
  }

  protected visitMinimum(node: MinimumNode, collector: SqlString) {
    return this.aggregate('MIN', node, collector);
  }

  protected visitNamedWindow(node: NamedWindowNode, collector: SqlString) {
    collector.collect(quoteIdentifier(node.name));
    collector.collect(' AS ');
    return this.visitWindow(node, collector);
  }

  protected visitNotIn(node: InNode, collector: SqlString) {
    const { left: attr, right: values } = node;

    if (Array.isArray(values)) {
      collector.preparable = false;

      if (values.length === 0) return collector.collect('1=1');

      values.forEach((_value) => {
        // delete value if it's unboundable
      });
    }

    this.visit(attr, collector);
    collector.collect(' NOT IN (');
    this.visit(values, collector);
    collector.collect(')');

    return collector;
  }

  protected visitNumber(node: number, collector: SqlString) {
    return collector.collect(node.toString());
  }

  protected visitOffset(node: OffsetNode, collector: SqlString) {
    collector.collect('OFFSET ');
    return this.visit(node.expression, collector);
  }

  protected visitOn(node: OnNode, collector: SqlString) {
    collector.collect('ON ');
    collector = this.visit(node.expression, collector);
    return collector;
  }

  protected visitOr(node: OrNode, collector: SqlString) {
    return this.injectJoin(node.children, collector, ' OR ');
  }

  protected visitOuterJoin(node: OuterJoinNode, collector: SqlString) {
    collector.collect('LEFT OUTER JOIN ');
    collector = this.visit(node.left, collector);
    collector.collect(' ');
    return this.visit(node.right, collector);
  }

  protected visitOver(node: OverNode, collector: SqlString) {
    if (node.right == null) {
      return this.visit(node.left, collector).collect(' OVER ()');
    }
    if (node.right instanceof Nodes.SqlLiteral) {
      return this.infixValue(node, collector, ' OVER ');
    }
    if (typeof node.right === 'string') {
      return this.visit(node.left, collector.collect(' OVER ').collect(quoteIdentifier(node.right)));
    }

    return this.infixValue(node, collector, ' OVER ');
  }

  protected visitQuoted = (node: QuotedNode, collector: SqlString) => {
    return collector.collect(quoteValue(node.valueForDatabase()));
  };

  protected visitRightOuterJoin(node: RightOuterJoinNode, collector: SqlString) {
    collector.collect('RIGHT OUTER JOIN ');
    collector = this.visit(node.left, collector);
    collector.collect(' ');
    return this.visit(node.right, collector);
  }

  protected visitSelectCore(node: SelectCoreNode, collector: SqlString) {
    collector.collect('SELECT');

    collector = this.maybeVisit(node.optimizerHints, collector);
    collector = this.maybeVisit(node.setQuantifier, collector);

    this.collectNodesFor(node.projections, collector, ' ');

    if (node.source && !node.source.empty()) {
      collector.collect(' FROM ');
      collector = this.visit(node.source, collector);
    }

    this.collectNodesFor(node.wheres, collector, ' WHERE ', ' AND ');
    this.collectNodesFor(node.groups, collector, ' GROUP BY ');
    this.collectNodesFor(node.havings, collector, ' HAVING ', ' AND ');
    this.collectNodesFor(node.windows, collector, ' WINDOW ');

    return this.maybeVisit(node.comment, collector);
  }

  protected visitSelectManager(node: SelectManager, collector: SqlString) {
    collector.collect('(');
    this.visit(node.ast, collector);
    collector.collect(')');

    return collector;
  }

  protected visitSelectOptions(node: SelectStatementNode, collector: SqlString) {
    collector = this.maybeVisit(node.limit, collector);
    collector = this.maybeVisit(node.offset, collector);
    return this.maybeVisit(node.lock, collector);
  }

  protected visitSelectStatement(node: SelectStatementNode, collector: SqlString) {
    if (node.with) {
      collector = this.visit(node.with, collector);
      collector.collect(' ');
    }

    collector = node.cores.reduce((c, core) => this.visitSelectCore(core, c), collector);

    if (node.orders.length > 0) {
      collector.collect(' ORDER BY ');
      node.orders.forEach((order, index) => {
        if (index > 0) collector.collect(', ');
        collector = this.visit(order, collector);
      });
    }

    return this.visitSelectOptions(node, collector);
  }

  protected visitSqlLiteral = (node: SqlLiteralNode, collector: SqlString) => {
    collector.preparable = false;
    collector.retryable &&= node.retryable ?? false;
    collector.collect(node.toString());

    return collector;
  };

  protected visitStringJoin(node: StringJoinNode, collector: SqlString) {
    return this.visit(node.left, collector);
  }

  protected visitSum(node: SumNode, collector: SqlString) {
    return this.aggregate('SUM', node, collector);
  }

  protected visitTable(node: Table, collector: SqlString) {
    if (typeof node.name === 'object') this.visit(node.name, collector);
    else collector.collect(quoteTableName(node.name));

    if (node.tableAlias) {
      collector.collect(' ').collect(quoteTableName(node.tableAlias));
    }

    return collector;
  }

  protected visitTableAlias(node: TableAliasNode, collector: SqlString) {
    collector = this.visit(node.relation, collector);
    collector.collect(' ');
    collector.collect(quoteTableName(node.name));

    return collector;
  }

  protected visitUnion(node: UnionNode, collector: SqlString) {
    return this.infixValueWithParen(node, collector, ' UNION ');
  }

  protected visitUnionAll(node: UnionAllNode, collector: SqlString) {
    return this.infixValueWithParen(node, collector, ' UNION ALL ');
  }

  protected visitWindow(node: WindowNode, collector: SqlString) {
    collector.collect('(');
    this.collectNodesFor(node.partitions, collector, 'PARTITION BY ');

    if (node.orders.length > 0) {
      if (node.partitions.length > 0) collector.collect(' ');
      collector.collect('ORDER BY ');
      this.injectJoin(node.orders, collector, ', ');
    }

    if (node.framing) {
      if (node.partitions.length > 0 || node.orders.length > 0) collector.collect(' ');
      this.visit(node.framing, collector);
    }

    return collector.collect(')');
  }

  private collectNodesFor(nodes: Node[], collector: SqlString, spacer: string, connector = ', ') {
    if (nodes.length > 0) {
      collector.collect(spacer);
      this.injectJoin(nodes, collector, connector);
    }
  }

  private aggregate(aggregateFunction: string, node: FunctionNode, collector: SqlString) {
    collector.collect(`${aggregateFunction}(`);
    if (node.distinct) collector.collect('DISTINCT ');
    this.injectJoin(node.expressions, collector, ', ');
    collector.collect(')');

    return collector;
  }

  private infixValue(node: OverNode, collector: SqlString, value: string) {
    collector = this.visit(node.left, collector);
    collector.collect(value);
    collector = this.visit(node.right, collector);
    return collector;
  }

  private infixValueWithParen(
    node: InfixOperationNode<string> | UnionNode | UnionAllNode,
    collector: SqlString,
    value: string,
    suppressParens = false,
  ) {
    if (!suppressParens) collector.collect('( ');

    if (node.left.constructor.name === node.constructor.name) {
      collector = this.infixValueWithParen(node.left, collector, value, true);
    } else {
      collector = this.visit(node.left, collector);
    }

    collector.collect(value);

    if (node.right.constructor.name === node.constructor.name) {
      collector = this.infixValueWithParen(node.right, collector, value, true);
    } else {
      collector = this.visit(node.right, collector);
    }

    if (!suppressParens) collector.collect(' )');

    return collector;
  }

  private injectJoin(nodes: Node[], collector: SqlString, joinString: string) {
    nodes.forEach((node, index) => {
      if (index > 0) collector.collect(joinString);
      collector = this.visit(node, collector);
    });
    return collector;
  }

  private maybeVisit(thing: Node | null, collector: SqlString) {
    if (!thing) return collector;

    collector.collect(' ');
    return this.visit(thing, collector);
  }
}
