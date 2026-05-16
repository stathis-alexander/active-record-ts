import type { Attribute } from '../Attribute';
import { Collectors } from '../Collectors';
import type { Collector } from '../Collectors/types';
import { Nodes } from '../Nodes';
import type { SelectManager } from '../SelectManager';
import type { Table } from '../Table';
import type {
  AscendingNode,
  AsNode,
  AssignmentNode,
  AverageNode,
  BetweenNode,
  BindParamNode,
  BinNode,
  BoundSqlLiteralNode,
  CaseNode,
  CastedNode,
  CommentNode,
  CountNode,
  CteNode,
  DeleteStatementNode,
  DescendingNode,
  DistinctNode,
  DistinctOnNode,
  ElseNode,
  EqualityNode,
  ExceptNode,
  ExistsNode,
  Expression,
  ExtractNode,
  FalseNode,
  FilterNode,
  FragmentsNode,
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
  InsertStatementNode,
  IntersectNode,
  IsDistinctFromNode,
  IsNotDistinctFromNode,
  JoinSourceNode,
  LateralNode,
  LimitNode,
  LockNode,
  MatchesNode,
  MaximumNode,
  MinimumNode,
  NamedFunctionNode,
  NamedWindowNode,
  NotNode,
  NullsFirstNode,
  NullsLastNode,
  OffsetNode,
  OnNode,
  OptimizerHintsNode,
  OrNode,
  OuterJoinNode,
  OverNode,
  QuotedNode,
  RightOuterJoinNode,
  SelectCoreNode,
  SelectStatementNode,
  SqlLiteralNode,
  StringJoinNode,
  SumNode,
  TableAliasNode,
  TrueNode,
  UnaryOperationNode,
  UnionAllNode,
  UnionNode,
  UnqualifiedColumnNode,
  UpdateStatementNode,
  ValuesListNode,
  WhenNode,
  WindowNode,
  WithNode,
  WithRecursiveNode,
} from '../types';
import { isNull } from '../utilities/nodes';
import { Visitor } from './Visitor';

const quoteIdentifier = (name: string): string => `\"${name.replaceAll('"', '')}\"`;
const quoteTableName = (name: string): string => {
  const [schema, table, ...rest] = name.split('.');
  if (!schema || rest.length > 0) throw new Error(`Invalid table name: ${name}`);
  if (!table) return quoteIdentifier(schema);
  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
};

export const quoteValue = (value: unknown): string => {
  if (value == null) return 'NULL';
  if (value instanceof Nodes.SqlLiteral) return value.toString();
  if (typeof value === 'string') return `'${value.replaceAll("'", "''")}'`;
  if (typeof value === 'boolean') return value ? "'t'" : "'f'";
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === 'object') return `'${JSON.stringify(value)}'`;
  throw new Error(`can't quote ${typeof value}: ${value}`);
};

/** Connection-like object passed by adapters; mostly used for quoting hooks. */
export type ConnectionLike = {
  quote?: (value: unknown) => string;
  schemaCache?: unknown;
};

/** Discriminated union of tokens produced by the bound-SQL tokenizer. */
type BoundSqlToken =
  | { type: 'literal'; value: string }
  | { type: 'positional'; value: '?' }
  | { type: 'named'; value: string; name: string };

export class ToSql extends Visitor {
  protected readonly connection: ConnectionLike | undefined;
  protected static readonly bindFunction = () => '?';

  constructor(connection?: ConnectionLike) {
    super();
    this.connection = connection;
  }

  compile(node: unknown, collector: Collector = new Collectors.SqlString()): unknown {
    return this.visit(node, collector).value();
  }

  protected visitAnd(node: { children: Expression[] }, collector: Collector) {
    return this.injectJoin(node.children, collector, ' AND ');
  }

  protected visitArray(nodes: Expression[], collector: Collector) {
    return this.injectJoin(nodes, collector, ', ');
  }

  protected visitSet(set: Set<Expression>, collector: Collector) {
    return this.injectJoin(Array.from(set), collector, ', ');
  }

  protected visitAs(node: AsNode, collector: Collector) {
    collector = this.visit(node.left, collector);
    collector.collect(' AS ');
    return this.visit(node.right, collector);
  }

  protected visitAscending(node: AscendingNode, collector: Collector) {
    return this.visit(node.expression, collector).collect(' ASC');
  }

  protected visitAssignment(node: AssignmentNode, collector: Collector) {
    collector = this.visit(node.left, collector);
    collector.collect(' = ');
    return this.visit(node.right, collector);
  }

  protected visitAttribute(node: Attribute, collector: Collector) {
    const { relation, name } = node;
    const relationName = relation.tableAlias ?? relation.name;
    if (relationName instanceof Nodes.SqlLiteral) {
      collector.collect(relationName.toString());
    } else if (typeof relationName === 'string') {
      collector.collect(quoteTableName(relationName));
    } else {
      this.visit(relationName, collector);
    }
    collector.collect('.');
    if (typeof name === 'string') {
      collector.collect(quoteIdentifier(name));
    } else {
      collector.collect((name as { toString(): string }).toString());
    }
    return collector;
  }

  protected visitAverage(node: AverageNode, collector: Collector) {
    return this.aggregate('AVG', node, collector);
  }

  protected visitBetween(node: BetweenNode, collector: Collector) {
    collector = this.visit(node.left, collector);
    collector.collect(' BETWEEN ');
    return this.visit(node.right, collector);
  }

  protected visitBin(node: BinNode, collector: Collector) {
    return this.visit(node.expression, collector);
  }

  protected visitBindParam(node: BindParamNode, collector: Collector) {
    collector.addBind(node, (this.constructor as typeof ToSql).bindFunction);
    return collector;
  }

  protected visitBoundSqlLiteral(node: BoundSqlLiteralNode, collector: Collector) {
    collector.preparable = false;
    collector.retryable = false;

    const binds = node.positionalBinds ?? this.extractNamedBinds(node);
    const tokens = this.tokenizeBoundSql(node.sqlWithPlaceHolders);
    let bindIdx = 0;

    for (const token of tokens) {
      if (token.type === 'literal') {
        collector.collect(token.value);
      } else {
        const bindValue = binds[bindIdx++];
        this.emitBindValue(bindValue, collector);
      }
    }
    return collector;
  }

  protected extractNamedBinds(node: BoundSqlLiteralNode): unknown[] {
    if (!node.namedBinds) return [];
    const named = node.namedBinds;
    const tokens = this.tokenizeBoundSql(node.sqlWithPlaceHolders);
    return tokens.flatMap((t) => (t.type === 'named' ? [named[t.name]] : []));
  }

  protected tokenizeBoundSql(sql: string): BoundSqlToken[] {
    const tokens: BoundSqlToken[] = [];
    const regex = /(\?|:([a-zA-Z]\w*))/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: matches Arel impl.
    while ((match = regex.exec(sql)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({ type: 'literal', value: sql.slice(lastIndex, match.index) });
      }
      if (match[1] === '?') {
        tokens.push({ type: 'positional', value: '?' });
      } else if (match[2]) {
        tokens.push({ type: 'named', value: match[0], name: match[2] });
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < sql.length) {
      tokens.push({ type: 'literal', value: sql.slice(lastIndex) });
    }
    return tokens;
  }

  protected emitBindValue(value: unknown, collector: Collector) {
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (i > 0) collector.collect(', ');
        this.emitArrayElement(v, collector);
      });
      return;
    }
    this.emitArrayElement(value, collector);
  }

  protected emitArrayElement(value: unknown, collector: Collector) {
    if (value instanceof Nodes.BoundSqlLiteral) {
      this.visitBoundSqlLiteral(value, collector);
      return;
    }
    if (value instanceof Nodes.SqlLiteral) {
      collector.collect(value.toString());
      return;
    }
    if (value instanceof Nodes.Node) {
      this.visit(value, collector);
      return;
    }
    // For nested array, treat as single bind
    collector.addBind(value, (this.constructor as typeof ToSql).bindFunction);
  }

  protected flattenBindArray(arr: unknown[]): unknown[] {
    const result: unknown[] = [];
    for (const item of arr) {
      if (Array.isArray(item)) {
        result.push(...this.flattenBindArray(item));
      } else {
        result.push(item);
      }
    }
    return result;
  }

  protected visitCasted(node: CastedNode, collector: Collector) {
    collector.collect(quoteValue(node.valueForDatabase()));
    return collector;
  }

  protected visitQuoted(node: QuotedNode, collector: Collector) {
    collector.collect(quoteValue(node.valueForDatabase()));
    return collector;
  }

  protected visitCase(node: CaseNode, collector: Collector) {
    collector.collect('CASE');
    if (node.case != null) {
      collector.collect(' ');
      collector = this.visit(node.case, collector);
    }
    for (const cond of node.conditions) {
      collector.collect(' ');
      collector = this.visit(cond, collector);
    }
    if (node.default != null) {
      collector.collect(' ');
      collector = this.visit(node.default, collector);
    }
    collector.collect(' END');
    return collector;
  }

  protected visitWhen(node: WhenNode, collector: Collector) {
    collector.collect('WHEN ');
    collector = this.visit(node.left, collector);
    collector.collect(' THEN ');
    return this.visit(node.right, collector);
  }

  protected visitElse(node: ElseNode, collector: Collector) {
    collector.collect('ELSE ');
    return this.visit(node.expression, collector);
  }

  protected visitComment(node: CommentNode, collector: Collector) {
    collector.collect('/* ');
    collector.collect(node.values.join(' ').replaceAll('*/', ''));
    collector.collect(' */');
    return collector;
  }

  protected visitCount(node: CountNode, collector: Collector) {
    return this.aggregate('COUNT', node, collector);
  }

  protected visitCte(node: CteNode, collector: Collector) {
    const name = node.name as string | { name?: string };
    const nameStr = typeof name === 'string' ? name : ((name as { name?: string }).name ?? String(name));
    collector.collect(quoteTableName(nameStr));
    collector.collect(' AS ');
    if (node.materialized === true) collector.collect('MATERIALIZED ');
    else if (node.materialized === false) collector.collect('NOT MATERIALIZED ');
    return this.visit(node.relation, collector);
  }

  protected visitDeleteStatement(node: DeleteStatementNode, collector: Collector) {
    collector.retryable = false;
    collector.preparable = false;
    collector.collect('DELETE FROM ');
    collector = this.visit(node.relation, collector);
    if (node.wheres.length > 0) {
      collector.collect(' WHERE ');
      this.injectJoin(node.wheres, collector, ' AND ');
    }
    collector = this.maybeVisit(node.limit, collector);
    return this.collectReturning(node.returning, collector);
  }

  /** Emit a `RETURNING ...` clause if any returning expressions are present. */
  protected collectReturning(returning: Expression[], collector: Collector) {
    if (returning && returning.length > 0) {
      collector.collect(' RETURNING ');
      this.injectJoin(returning, collector, ', ');
    }
    return collector;
  }

  protected visitDescending(node: DescendingNode, collector: Collector) {
    return this.visit(node.expression, collector).collect(' DESC');
  }

  protected visitDistinct(_node: DistinctNode, collector: Collector) {
    collector.collect('DISTINCT');
    return collector;
  }

  protected visitDistinctOn(_node: DistinctOnNode, _collector: Collector): Collector {
    throw new Error('NotImplementedError: DISTINCT ON not implemented for this database');
  }

  protected visitDoesNotMatch(node: MatchesNode, collector: Collector) {
    collector = this.visit(node.left, collector);
    collector.collect(' NOT LIKE ');
    collector = this.visit(node.right, collector);
    if (node.escape) {
      collector.collect(' ESCAPE ');
      collector = this.visit(node.escape, collector);
    }
    return collector;
  }

  protected visitEquality(node: EqualityNode, collector: Collector) {
    const { right, left } = node;
    collector = this.visit(left, collector);
    if (isNull(right)) return collector.collect(' IS NULL');
    collector.collect(' = ');
    return this.visit(right, collector);
  }

  protected visitExists(node: ExistsNode, collector: Collector) {
    collector.collect('EXISTS (');
    this.visit(node.expressions, collector);
    return collector.collect(')');
  }

  protected visitExtract(node: ExtractNode, collector: Collector) {
    collector.collect('EXTRACT(');
    collector.collect(node.field.toString().toUpperCase());
    collector.collect(' FROM ');
    this.visit(node.expression, collector);
    collector.collect(')');
    return collector;
  }

  protected visitFalse(_node: FalseNode, collector: Collector) {
    collector.collect('FALSE');
    return collector;
  }

  protected visitFalseClass(_node: boolean, collector: Collector) {
    collector.collect("'f'");
    return collector;
  }

  protected visitFilter(node: FilterNode, collector: Collector) {
    collector = this.visit(node.left, collector);
    collector.collect(' FILTER (WHERE ');
    collector = this.visit(node.right, collector);
    collector.collect(')');
    return collector;
  }

  protected visitFragments(node: FragmentsNode, collector: Collector) {
    const parts: string[] = [];
    for (const value of node.values) {
      const tempCol = new Collectors.SqlString();
      this.visit(value, tempCol);
      parts.push(tempCol.value());
    }
    const joined = parts.reduce((acc, part) => {
      if (acc === '') return part;
      if (acc.endsWith(' ') || part.startsWith(' ')) return acc + part;
      return `${acc} ${part}`;
    }, '');
    collector.collect(joined);
    return collector;
  }

  protected visitFullOuterJoin(node: FullOuterJoinNode, collector: Collector) {
    collector.collect('FULL OUTER JOIN ');
    collector = this.visit(node.left, collector);
    collector.collect(' ');
    return this.visit(node.right, collector);
  }

  protected visitGreaterThan(node: GreaterThanNode, collector: Collector) {
    this.visit(node.left, collector);
    collector.collect(' > ');
    return this.visit(node.right, collector);
  }

  protected visitGreaterThanOrEqual(node: GreaterThanNode, collector: Collector) {
    this.visit(node.left, collector);
    collector.collect(' >= ');
    return this.visit(node.right, collector);
  }

  protected visitGroup(node: GroupNode, collector: Collector) {
    return this.visit(node.expression, collector);
  }

  protected visitGrouping(node: GroupingNode, collector: Collector) {
    if (node.expression instanceof Nodes.Grouping) {
      this.visit(node.expression, collector);
    } else {
      collector.collect('(');
      this.visit(node.expression, collector);
      collector.collect(')');
    }
    return collector;
  }

  protected visitHomogeneousIn(node: HomogeneousInNode, collector: Collector) {
    collector.preparable = false;
    this.visit(node.left(), collector);
    if (node.type === 'in') collector.collect(' IN (');
    else collector.collect(' NOT IN (');

    const values = node.values;
    if (values.length === 0) {
      collector.collect('NULL');
    } else {
      collector.addBinds(values, node.procForBinds(), (this.constructor as typeof ToSql).bindFunction);
    }
    return collector.collect(')');
  }

  protected visitIn(node: InNode, collector: Collector) {
    const { left: attr, right: values } = node;
    if (Array.isArray(values)) {
      collector.preparable = false;
      if (values.length === 0) return collector.collect('1=0');
    }
    this.visit(attr, collector);
    collector.collect(' IN (');
    this.visit(values, collector);
    collector.collect(')');
    return collector;
  }

  protected visitInequality(node: InequalityNode, collector: Collector) {
    const { right, left } = node;
    collector = this.visit(left, collector);
    if (isNull(right)) return collector.collect(' IS NOT NULL');
    collector.collect(' != ');
    return this.visit(right, collector);
  }

  protected visitInfixOperation(node: InfixOperationNode<string>, collector: Collector) {
    const parenthesized = ['+', '-', '&', '|', '^', '<<', '>>'].includes(node.operator);
    if (parenthesized) collector.collect('(');
    collector = this.visit(node.left, collector);
    collector.collect(` ${node.operator} `);
    collector = this.visit(node.right, collector);
    if (parenthesized) collector.collect(')');
    return collector;
  }

  protected visitInnerJoin(node: InnerJoinNode, collector: Collector) {
    collector.collect('INNER JOIN ');
    collector = this.visit(node.left, collector);
    if (node.right) {
      collector.collect(' ');
      return this.visit(node.right, collector);
    }
    return collector;
  }

  protected visitInsertStatement(node: InsertStatementNode, collector: Collector) {
    collector.retryable = false;
    collector.preparable = false;
    collector.collect('INSERT INTO ');
    collector = this.visit(node.relation, collector);

    if (node.columns.length > 0) {
      const columnNames = node.columns
        .map((c) => {
          const named = c as { name?: string };
          return quoteIdentifier(named.name ?? String(c));
        })
        .join(', ');
      collector.collect(` (${columnNames})`);
    }

    if (node.values) {
      collector.collect(' ');
      collector = this.visit(node.values, collector);
    } else if (node.select) {
      collector.collect(' ');
      // For INSERT ... SELECT, render the select without FROM (the FROM is implicit from INTO target)
      const select = node.select as { ast?: SelectStatementNode } | SelectStatementNode;
      const selectAst = (select as { ast?: SelectStatementNode }).ast ?? (select as SelectStatementNode);
      if (
        selectAst.cores &&
        Array.isArray(selectAst.cores) &&
        this.allCoresFromInsertTarget(selectAst, node.relation)
      ) {
        collector.collect('(');
        this.visitInsertSelect(selectAst, collector);
        collector.collect(')');
      } else {
        collector = this.visit(node.select, collector);
      }
    }

    return this.collectReturning(node.returning, collector);
  }

  protected allCoresFromInsertTarget(selectAst: SelectStatementNode, insertRelation: unknown): boolean {
    if (!selectAst.cores) return false;
    return selectAst.cores.every((c) => c.from === insertRelation);
  }

  protected visitInsertSelect(selectAst: SelectStatementNode, collector: Collector) {
    if (selectAst.with) {
      collector = this.visit(selectAst.with, collector);
      collector.collect(' ');
    }
    selectAst.cores.forEach((core, idx) => {
      if (idx > 0) collector.collect(' ');
      collector.collect('SELECT');
      collector = this.maybeVisit(core.optimizerHints, collector);
      collector = this.maybeVisit(core.setQuantifier, collector);
      this.collectNodesFor(core.projections, collector, ' ');
      this.collectNodesFor(core.wheres, collector, ' WHERE ', ' AND ');
      this.collectNodesFor(core.groups, collector, ' GROUP BY ');
      this.collectNodesFor(core.havings, collector, ' HAVING ', ' AND ');
    });
    return collector;
  }

  protected visitIsDistinctFrom(node: IsDistinctFromNode, collector: Collector) {
    if (isNull(node.right)) {
      return this.visitInequality(node as unknown as InequalityNode, collector);
    }
    collector.collect('CASE WHEN ');
    collector = this.visit(node.left, collector);
    collector.collect(' = ');
    collector = this.visit(node.right, collector);
    collector.collect(' OR (');
    collector = this.visit(node.left, collector);
    collector.collect(' IS NULL AND ');
    collector = this.visit(node.right, collector);
    collector.collect(' IS NULL) THEN 0 ELSE 1 END = 1');
    return collector;
  }

  protected visitIsNotDistinctFrom(node: IsNotDistinctFromNode, collector: Collector) {
    if (isNull(node.right)) {
      return this.visitEquality(node as unknown as EqualityNode, collector);
    }
    collector.collect('CASE WHEN ');
    collector = this.visit(node.left, collector);
    collector.collect(' = ');
    collector = this.visit(node.right, collector);
    collector.collect(' OR (');
    collector = this.visit(node.left, collector);
    collector.collect(' IS NULL AND ');
    collector = this.visit(node.right, collector);
    collector.collect(' IS NULL) THEN 0 ELSE 1 END = 0');
    return collector;
  }

  protected visitJoinSource(node: JoinSourceNode, collector: Collector) {
    if (node.left) collector = this.visit(node.left, collector);
    if (node.right.length > 0) {
      if (node.left) collector.collect(' ');
      collector = this.injectJoin(node.right, collector, ' ');
    }
    return collector;
  }

  protected visitLateral(node: LateralNode, collector: Collector) {
    collector.collect('LATERAL ');
    return this.visit(node.expression, collector);
  }

  protected visitLessThan(node: GreaterThanNode, collector: Collector) {
    this.visit(node.left, collector);
    collector.collect(' < ');
    return this.visit(node.right, collector);
  }

  protected visitLessThanOrEqual(node: GreaterThanNode, collector: Collector) {
    this.visit(node.left, collector);
    collector.collect(' <= ');
    return this.visit(node.right, collector);
  }

  protected visitLimit(node: LimitNode, collector: Collector) {
    collector.collect('LIMIT ');
    return this.visit(node.expression, collector);
  }

  protected visitLock(node: LockNode, collector: Collector) {
    return this.visit(node.expression, collector);
  }

  protected visitMatches(node: MatchesNode, collector: Collector) {
    collector = this.visit(node.left, collector);
    collector.collect(' LIKE ');
    collector = this.visit(node.right, collector);
    if (node.escape) {
      collector.collect(' ESCAPE ');
      collector = this.visit(node.escape, collector);
    }
    return collector;
  }

  protected visitMaximum(node: MaximumNode, collector: Collector) {
    return this.aggregate('MAX', node, collector);
  }

  protected visitMinimum(node: MinimumNode, collector: Collector) {
    return this.aggregate('MIN', node, collector);
  }

  protected visitNamedFunction(node: NamedFunctionNode, collector: Collector) {
    collector.retryable = false;
    collector.collect(`${node.name}(`);
    if (node.distinct) collector.collect('DISTINCT ');
    const exprs = Array.isArray(node.expressions) ? node.expressions : [node.expressions];
    this.injectJoin(exprs, collector, ', ');
    return collector.collect(')');
  }

  protected visitNamedWindow(node: NamedWindowNode, collector: Collector) {
    collector.collect(quoteIdentifier(node.name));
    collector.collect(' AS ');
    return this.visitWindow(node, collector);
  }

  protected visitNot(node: NotNode, collector: Collector) {
    collector.collect('NOT (');
    collector = this.visit(node.expression, collector);
    return collector.collect(')');
  }

  protected visitNotIn(node: InNode, collector: Collector) {
    const { left: attr, right: values } = node;
    if (Array.isArray(values)) {
      collector.preparable = false;
      if (values.length === 0) return collector.collect('1=1');
    }
    this.visit(attr, collector);
    collector.collect(' NOT IN (');
    this.visit(values, collector);
    collector.collect(')');
    return collector;
  }

  protected visitNullsFirst(node: NullsFirstNode, collector: Collector) {
    collector = this.visit(node.expression, collector);
    return collector.collect(' NULLS FIRST');
  }

  protected visitNullsLast(node: NullsLastNode, collector: Collector) {
    collector = this.visit(node.expression, collector);
    return collector.collect(' NULLS LAST');
  }

  protected visitNumber(node: number, collector: Collector) {
    return collector.collect(node.toString());
  }

  protected visitOffset(node: OffsetNode, collector: Collector) {
    collector.collect('OFFSET ');
    return this.visit(node.expression, collector);
  }

  protected visitOn(node: OnNode, collector: Collector) {
    collector.collect('ON ');
    collector = this.visit(node.expression, collector);
    return collector;
  }

  protected visitOptimizerHints(node: OptimizerHintsNode, collector: Collector) {
    const hints = (Array.isArray(node.expression) ? node.expression : [node.expression])
      .map((h: unknown) => (typeof h === 'string' ? h : String(h)))
      .join(' ');
    collector.collect(` /*+ ${hints} */`);
    return collector;
  }

  protected visitOr(node: OrNode, collector: Collector) {
    return this.injectJoin(node.children, collector, ' OR ');
  }

  protected visitOuterJoin(node: OuterJoinNode, collector: Collector) {
    collector.collect('LEFT OUTER JOIN ');
    collector = this.visit(node.left, collector);
    collector.collect(' ');
    return this.visit(node.right, collector);
  }

  protected visitOver(node: OverNode, collector: Collector) {
    if (node.right == null) {
      return this.visit(node.left, collector).collect(' OVER ()');
    }
    if (node.right instanceof Nodes.SqlLiteral) {
      return this.infixValue(node, collector, ' OVER ');
    }
    if (typeof node.right === 'string') {
      collector = this.visit(node.left, collector);
      collector.collect(' OVER ').collect(quoteIdentifier(node.right));
      return collector;
    }
    return this.infixValue(node, collector, ' OVER ');
  }

  protected visitRegexp(_node: unknown, _collector: Collector): Collector {
    throw new Error('NotImplementedError: Regexp not implemented for this database');
  }

  protected visitNotRegexp(_node: unknown, _collector: Collector): Collector {
    throw new Error('NotImplementedError: NotRegexp not implemented for this database');
  }

  protected visitRightOuterJoin(node: RightOuterJoinNode, collector: Collector) {
    collector.collect('RIGHT OUTER JOIN ');
    collector = this.visit(node.left, collector);
    collector.collect(' ');
    return this.visit(node.right, collector);
  }

  protected visitSelectCore(node: SelectCoreNode, collector: Collector) {
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

  protected visitSelectManager(node: SelectManager, collector: Collector) {
    collector.collect('(');
    this.visit(node.ast, collector);
    collector.collect(')');
    return collector;
  }

  protected visitSelectOptions(node: SelectStatementNode, collector: Collector) {
    collector = this.maybeVisit(node.limit, collector);
    collector = this.maybeVisit(node.offset, collector);
    return this.maybeVisit(node.lock, collector);
  }

  protected visitSelectStatement(node: SelectStatementNode, collector: Collector) {
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

  protected visitSqlLiteral(node: SqlLiteralNode, collector: Collector) {
    collector.preparable = false;
    collector.retryable = (collector.retryable ?? true) && (node.retryable ?? false);
    collector.collect(node.toString());
    return collector;
  }

  protected visitString(node: string, collector: Collector) {
    collector.collect(quoteValue(node));
    return collector;
  }

  protected visitStringJoin(node: StringJoinNode, collector: Collector) {
    return this.visit(node.left, collector);
  }

  protected visitSum(node: SumNode, collector: Collector) {
    return this.aggregate('SUM', node, collector);
  }

  protected visitTable(node: Table, collector: Collector) {
    if (node.name instanceof Nodes.SqlLiteral || (node.name && typeof node.name === 'object')) {
      this.visit(node.name, collector);
    } else {
      collector.collect(quoteTableName(node.name));
    }

    if (node.tableAlias) {
      collector.collect(' ').collect(quoteTableName(node.tableAlias));
    }
    return collector;
  }

  protected visitTableAlias(node: TableAliasNode, collector: Collector) {
    collector = this.visit(node.relation, collector);
    collector.collect(' ');
    if (node.name instanceof Nodes.SqlLiteral) {
      collector.collect(node.name.toString());
    } else {
      collector.collect(quoteTableName(node.name));
    }
    return collector;
  }

  protected visitTrue(_node: TrueNode, collector: Collector) {
    collector.collect('TRUE');
    return collector;
  }

  protected visitTrueClass(_node: boolean, collector: Collector) {
    collector.collect("'t'");
    return collector;
  }

  protected visitUnaryOperation(node: UnaryOperationNode, collector: Collector) {
    collector.collect(` ${node.operator} `);
    return this.visit(node.expression, collector);
  }

  protected visitUnion(node: UnionNode, collector: Collector) {
    return this.infixValueWithParen(node, collector, ' UNION ');
  }

  protected visitUnionAll(node: UnionAllNode, collector: Collector) {
    return this.infixValueWithParen(node, collector, ' UNION ALL ');
  }

  protected visitIntersect(node: IntersectNode, collector: Collector) {
    return this.infixValueWithParen(node, collector, ' INTERSECT ');
  }

  protected visitExcept(node: ExceptNode, collector: Collector) {
    return this.infixValueWithParen(node, collector, ' EXCEPT ');
  }

  protected visitUnqualifiedColumn(node: UnqualifiedColumnNode, collector: Collector) {
    const name = typeof node.expression === 'string' ? node.expression : node.expression?.name;
    collector.collect(quoteIdentifier(name));
    return collector;
  }

  protected visitUpdateStatement(node: UpdateStatementNode, collector: Collector) {
    collector.retryable = false;
    collector.preparable = false;
    collector.collect('UPDATE ');
    collector = this.visit(node.relation, collector);

    if (node.values.length > 0) {
      collector.collect(' SET ');
      this.injectJoin(node.values, collector, ', ');
    }

    if (node.wheres.length > 0) {
      collector.collect(' WHERE ');
      this.injectJoin(node.wheres, collector, ' AND ');
    }

    if (node.groups && node.groups.length > 0) {
      collector.collect(' GROUP BY ');
      this.injectJoin(node.groups, collector, ', ');
    }

    if (node.havings && node.havings.length > 0) {
      collector.collect(' HAVING ');
      this.injectJoin(node.havings, collector, ' AND ');
    }

    if (node.orders && node.orders.length > 0) {
      collector.collect(' ORDER BY ');
      this.injectJoin(node.orders, collector, ', ');
    }

    collector = this.maybeVisit(node.limit, collector);
    return this.collectReturning(node.returning, collector);
  }

  protected visitValuesList(node: ValuesListNode, collector: Collector) {
    collector.collect('VALUES ');
    node.rows.forEach((row, i) => {
      if (i > 0) collector.collect(', ');
      collector.collect('(');
      row.forEach((value, idx) => {
        if (idx > 0) collector.collect(', ');
        if (value == null) {
          collector.collect('NULL');
        } else if (value instanceof Nodes.SqlLiteral || value instanceof Nodes.BindParam) {
          this.visit(value, collector);
        } else if (typeof value === 'object' && value instanceof Nodes.Node) {
          this.visit(value, collector);
        } else {
          collector.collect(quoteValue(value));
        }
      });
      collector.collect(')');
    });
    return collector;
  }

  protected visitWindow(node: WindowNode, collector: Collector) {
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

  protected visitWith(node: WithNode, collector: Collector) {
    collector.collect('WITH ');
    return this.visitWithExpressions(node.expression, collector);
  }

  protected visitWithRecursive(node: WithRecursiveNode, collector: Collector) {
    collector.collect('WITH RECURSIVE ');
    return this.visitWithExpressions(node.expression, collector);
  }

  private visitWithExpressions(expressions: Expression | Expression[], collector: Collector) {
    const exprs = Array.isArray(expressions) ? expressions : [expressions];
    exprs.forEach((expr, i) => {
      if (i > 0) collector.collect(', ');
      if (expr instanceof Nodes.TableAlias) {
        // For CTE: "name AS (query)"
        const exprName = expr.name as unknown;
        if (exprName instanceof Nodes.SqlLiteral) {
          collector.collect(exprName.toString());
        } else if (typeof exprName === 'string') {
          collector.collect(exprName);
        } else {
          collector.collect(String(exprName));
        }
        collector.collect(' AS ');
        this.visit(expr.relation, collector);
      } else {
        this.visit(expr, collector);
      }
    });
    return collector;
  }

  protected visitNilClass(_node: null, _collector: Collector): Collector {
    throw new Error('Unsupported: Cannot visit null directly. Use buildQuoted(null) instead.');
  }

  protected visitObject(node: object, collector: Collector) {
    collector.collect(quoteValue(node));
    return collector;
  }

  protected visitDate(node: Date, collector: Collector) {
    collector.collect(quoteValue(node));
    return collector;
  }

  protected collectNodesFor(nodes: Expression[], collector: Collector, spacer: string, connector = ', ') {
    if (nodes.length > 0) {
      collector.collect(spacer);
      this.injectJoin(nodes, collector, connector);
    }
  }

  protected aggregate(aggregateFunction: string, node: FunctionNode, collector: Collector) {
    collector.collect(`${aggregateFunction}(`);
    if (node.distinct) collector.collect('DISTINCT ');
    const exprs = Array.isArray(node.expressions) ? node.expressions : [node.expressions];
    this.injectJoin(exprs, collector, ', ');
    collector.collect(')');
    return collector;
  }

  /** Generic binary-shape input — anything with `.left` / `.right`. */
  protected infixValue(node: { left: unknown; right: unknown }, collector: Collector, value: string) {
    collector = this.visit(node.left, collector);
    collector.collect(value);
    collector = this.visit(node.right, collector);
    return collector;
  }

  protected infixValueWithParen(
    node: { left: unknown; right: unknown },
    collector: Collector,
    value: string,
    suppressParens = false,
  ) {
    if (!suppressParens) collector.collect('( ');

    const left = node.left as { constructor?: { name?: string }; left?: unknown; right?: unknown } | undefined;
    const right = node.right as { constructor?: { name?: string }; left?: unknown; right?: unknown } | undefined;
    const sameKind = (peer: typeof left): peer is { left: unknown; right: unknown } =>
      !!peer &&
      !!peer.constructor &&
      peer.constructor.name === (node as { constructor: { name: string } }).constructor.name;

    if (sameKind(left)) {
      collector = this.infixValueWithParen(left, collector, value, true);
    } else {
      collector = this.visit(node.left, collector);
    }

    collector.collect(value);

    if (sameKind(right)) {
      collector = this.infixValueWithParen(right, collector, value, true);
    } else {
      collector = this.visit(node.right, collector);
    }

    if (!suppressParens) collector.collect(' )');
    return collector;
  }

  protected injectJoin(nodes: Expression[], collector: Collector, joinString: string) {
    nodes.forEach((node, index) => {
      if (index > 0) collector.collect(joinString);
      collector = this.visit(node, collector);
    });
    return collector;
  }

  protected maybeVisit(thing: unknown, collector: Collector) {
    if (!thing) return collector;
    collector.collect(' ');
    return this.visit(thing, collector);
  }
}
