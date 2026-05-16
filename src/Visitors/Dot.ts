import type { Collector } from '../Collectors/types';
import type { Expression } from '../types';
import { Visitor, type VisitTarget } from './Visitor';

const quote = (str: unknown) => String(str).replace(/"/g, '\\"');

type DotNode = {
  name: string;
  fields: string[];
  id: number;
};

type DotEdge = {
  from: DotNode;
  to: DotNode;
  name: string;
};

/**
 * Structural shapes accepted by the Dot visitor's handler methods. Each shape
 * is what the handler reads off the node — we don't import the full node
 * classes because the visitor is purely structural. Field types are the
 * documented shape from the corresponding node class (e.g. `Expression` for
 * left/right/expression slots, `Expression[]` for children/values arrays).
 *
 * Where the field is intentionally heterogeneous (e.g. `name` may be a string,
 * number, or wrapped node), the broader `Expression` union covers it.
 */
type DotPayload = Expression | Expression[] | null;

type WithExpression = { expression: Expression };
type WithLeftRight = { left: Expression; right: Expression };
type WithChildren = { children: Expression[] };
type WithCaseFields = { case: Expression | null; conditions: Expression[]; default: DotPayload };
type WithOperatorBinary = { operator: string; left: Expression; right: Expression };
type WithOperatorUnary = { operator: string; expression: Expression };
type WithName = { name: Expression };
type WithExpressionsField = { expressions: Expression | Expression[] };
type WithRegexp = { left: Expression; right: Expression; caseSensitive: boolean };

type SelectCoreShape = {
  source: Expression;
  projections: Expression[];
  wheres: Expression[];
  groups: Expression[];
  havings: Expression[];
};

type SelectStatementShape = {
  cores: Expression[];
  limit: Expression | null;
  orders: Expression[];
  offset: Expression | null;
};

type InsertStatementShape = {
  relation: Expression | null;
  columns: Expression[];
  values: Expression | null;
};

type UpdateStatementShape = {
  relation: Expression | null;
  wheres: Expression[];
  values: Expression[];
  orders: Expression[];
  limit: Expression | null;
  key: Expression | null;
};

type DeleteStatementShape = {
  relation: Expression | null;
  wheres: Expression[];
  orders: Expression[];
  limit: Expression | null;
  key: Expression | null;
};

type TableAliasShape = { relation: Expression; name: Expression };

type NamedFunctionShape = { name: string; expressions: Expression | Expression[] };

type WithFieldExpression = { expression: Expression | Expression[] };

/** A `handle<TypeName>` method on the `Dot` visitor — accepts any object payload. */
type DotHandler = (this: Dot, o: object) => void;

/** Indexed accessor for `handle*` methods on the visitor instance. */
type DotHandlerMap = Record<string, DotHandler | undefined>;

/** Read `obj.constructor.name`, returning `''` if absent. Avoids per-call object guards. */
const constructorName = (obj: object): string => {
  const ctor = (obj as { constructor?: { name?: string } }).constructor;
  return ctor?.name || '';
};

let idCounter = 0;
const nextId = () => ++idCounter;

export class Dot extends Visitor {
  private nodes: DotNode[] = [];
  private edges: DotEdge[] = [];
  private nodeStack: DotNode[] = [];
  private seen: WeakMap<object, DotNode> = new WeakMap();

  override accept = <C extends Collector>(object: VisitTarget, collector?: C): C => {
    this.visitInner(object as DotPayload);
    if (collector) {
      collector.collect(this.toDot());
    }
    return collector as C;
  };

  private visitInner(o: DotPayload): DotNode | null {
    if (o == null) {
      const node: DotNode = { name: 'nil', fields: [], id: nextId() };
      this.nodes.push(node);
      return node;
    }
    if (typeof o !== 'object') {
      const node: DotNode = { name: String(o), fields: [], id: nextId() };
      this.nodes.push(node);
      return node;
    }

    const seen = this.seen.get(o);
    if (seen) return seen;

    const cleanName = constructorName(o).replace('Node', '') || 'Object';
    const node: DotNode = { name: cleanName, fields: [], id: nextId() };
    this.seen.set(o, node);
    this.nodes.push(node);

    this.nodeStack.push(node);
    this.dispatch(o);
    this.nodeStack.pop();

    return node;
  }

  private dispatch(o: object) {
    const cleaned = constructorName(o).replace('Node', '');
    let fn = this.handlerFor(cleaned);
    if (fn) {
      fn.call(this, o);
      return;
    }

    let proto: object | null = Object.getPrototypeOf(o);
    let depth = 0;
    while (proto && depth < 10) {
      const protoCleaned = constructorName(proto).replace('Node', '');
      if (protoCleaned) {
        fn = this.handlerFor(protoCleaned);
        if (fn) {
          fn.call(this, o);
          return;
        }
      }
      proto = Object.getPrototypeOf(proto);
      depth++;
    }
  }

  /**
   * Look up a `handle<TypeName>` method on this visitor by name. Returns the
   * function or `null` if no handler is registered.
   */
  private handlerFor(typeName: string): DotHandler | null {
    if (!typeName) return null;
    const fn = (this as unknown as DotHandlerMap)[`handle${typeName}`];
    return typeof fn === 'function' ? fn : null;
  }

  private addEdge(name: string, value: DotPayload) {
    const from = this.nodeStack[this.nodeStack.length - 1];
    if (!from) return;
    if (Array.isArray(value)) {
      const arrNode: DotNode = { name: 'Array', fields: [], id: nextId() };
      this.nodes.push(arrNode);
      this.edges.push({ from, to: arrNode, name });
      this.nodeStack.push(arrNode);
      value.forEach((item, i) => {
        const child = this.visitInner(item);
        if (child) this.edges.push({ from: arrNode, to: child, name: String(i) });
      });
      this.nodeStack.pop();
      return;
    }
    const child = this.visitInner(value);
    if (child) this.edges.push({ from, to: child, name });
  }

  // Handlers
  protected handleAttribute(o: WithName) {
    this.addEdge('value_before_type_cast', o.name);
  }

  protected handleBindParam(o: { value: Expression }) {
    this.addEdge('value', o.value);
  }

  protected handleComment(o: { values: Expression[] }) {
    this.addEdge('values', o.values);
  }

  protected handleCase(o: WithCaseFields) {
    this.addEdge('case', o.case);
    this.addEdge('conditions', o.conditions);
    this.addEdge('default', o.default);
  }

  protected handleUnary(o: WithExpression) {
    this.addEdge('expr', o.expression);
  }
  protected handleNot(o: WithExpression) {
    this.handleUnary(o);
  }
  protected handleGroup(o: WithExpression) {
    this.handleUnary(o);
  }
  protected handleGrouping(o: WithExpression) {
    this.handleUnary(o);
  }
  protected handleUnqualifiedColumn(o: WithExpression) {
    this.handleUnary(o);
  }

  protected handleBinary(o: WithLeftRight) {
    this.addEdge('left', o.left);
    this.addEdge('right', o.right);
  }
  protected handleAssignment(o: WithLeftRight) {
    this.handleBinary(o);
  }
  protected handleEquality(o: WithLeftRight) {
    this.handleBinary(o);
  }
  protected handleIn(o: WithLeftRight) {
    this.handleBinary(o);
  }

  protected handleTableAlias(o: TableAliasShape) {
    this.addEdge('relation', o.relation);
    this.addEdge('name', o.name);
  }

  protected handleNary(o: WithChildren) {
    o.children.forEach((child, i) => {
      const childNode = this.visitInner(child);
      const from = this.nodeStack[this.nodeStack.length - 1];
      if (childNode && from) this.edges.push({ from, to: childNode, name: String(i) });
    });
  }
  protected handleAnd(o: WithChildren) {
    this.handleNary(o);
  }
  protected handleOr(o: WithChildren) {
    this.handleNary(o);
  }

  protected handleInfixOperation(o: WithOperatorBinary) {
    this.addEdge('operator', o.operator);
    this.addEdge('left', o.left);
    this.addEdge('right', o.right);
  }

  protected handleRegexp(o: WithRegexp) {
    this.addEdge('left', o.left);
    this.addEdge('right', o.right);
    this.addEdge('case_sensitive', o.caseSensitive);
  }
  protected handleNotRegexp(o: WithRegexp) {
    this.handleRegexp(o);
  }

  protected handleUnaryOperation(o: WithOperatorUnary) {
    this.addEdge('operator', o.operator);
    this.addEdge('expr', o.expression);
  }

  protected handleWith(o: WithFieldExpression) {
    const exprs = Array.isArray(o.expression) ? (o.expression as Expression[]) : [o.expression as Expression];
    exprs.forEach((item, i) => {
      const child = this.visitInner(item);
      const from = this.nodeStack[this.nodeStack.length - 1];
      if (child && from) this.edges.push({ from, to: child, name: String(i) });
    });
  }

  protected handleSelectCore(o: SelectCoreShape) {
    this.addEdge('source', o.source);
    this.addEdge('projections', o.projections);
    this.addEdge('wheres', o.wheres);
    this.addEdge('groups', o.groups);
    this.addEdge('havings', o.havings);
  }

  protected handleSelectStatement(o: SelectStatementShape) {
    this.addEdge('cores', o.cores);
    this.addEdge('limit', o.limit);
    this.addEdge('orders', o.orders);
    this.addEdge('offset', o.offset);
  }

  protected handleInsertStatement(o: InsertStatementShape) {
    this.addEdge('relation', o.relation);
    this.addEdge('columns', o.columns);
    this.addEdge('values', o.values);
  }

  protected handleUpdateStatement(o: UpdateStatementShape) {
    this.addEdge('relation', o.relation);
    this.addEdge('wheres', o.wheres);
    this.addEdge('values', o.values);
    this.addEdge('orders', o.orders);
    this.addEdge('limit', o.limit);
    this.addEdge('key', o.key);
  }

  protected handleDeleteStatement(o: DeleteStatementShape) {
    this.addEdge('relation', o.relation);
    this.addEdge('wheres', o.wheres);
    this.addEdge('orders', o.orders);
    this.addEdge('limit', o.limit);
    this.addEdge('key', o.key);
  }

  protected handleFunction(o: WithExpressionsField) {
    this.addEdge('expressions', o.expressions);
  }
  protected handleSum(o: WithExpressionsField) {
    this.handleFunction(o);
  }
  protected handleCount(o: WithExpressionsField) {
    this.handleFunction(o);
  }
  protected handleMaximum(o: WithExpressionsField) {
    this.handleFunction(o);
  }
  protected handleMinimum(o: WithExpressionsField) {
    this.handleFunction(o);
  }
  protected handleAverage(o: WithExpressionsField) {
    this.handleFunction(o);
  }

  protected handleNamedFunction(o: NamedFunctionShape) {
    this.addEdge('name', o.name);
    this.addEdge('expressions', o.expressions);
  }

  toDot() {
    const dotOutputs: string[] = [];
    dotOutputs.push('digraph "Arel" {');
    dotOutputs.push('node [width=0.0375,height=0.25,shape=record];');

    this.nodes.forEach((node) => {
      let label = `<f0>${node.name}`;
      node.fields.forEach((field, index) => {
        label += `|<f${index + 1}>${quote(field)}`;
      });
      dotOutputs.push(`${node.id} [label="${label}"]`);
    });

    this.edges.forEach((edge) => {
      dotOutputs.push(`${edge.from.id} -> ${edge.to.id} [label="${edge.name}"]`);
    });
    dotOutputs.push('}');

    return dotOutputs.join('\n');
  }

  // Provide value() returns dot string for compatibility
  value() {
    return this.toDot();
  }
}
