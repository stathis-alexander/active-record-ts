import type { Collector } from '../Collectors/types';

/**
 * Anything a visitor's `accept`/`visit` may receive. The visitor is genuinely
 * dynamic — it dispatches by class name to a `visit<TypeName>` method —
 * so `unknown` is the correct upper bound here. Concrete `visit*` methods
 * declare their precise expected node types.
 */
export type VisitTarget = unknown;

type VisitMethod = (object: VisitTarget, collector: Collector | undefined) => Collector;

export class Visitor {
  accept = <C extends Collector>(object: VisitTarget, collector?: C): C => this.visit(object, collector);

  protected visit = <C extends Collector>(object: VisitTarget, collector?: C): C => {
    const visitFunc = this.resolveVisitor(object);
    if (!visitFunc) {
      const name = nodeType(object);
      throw new Error(`Unsupported: No visit method for node of type: ${name}`);
    }
    return visitFunc.call(this, object, collector) as C;
  };

  private resolveVisitor(object: VisitTarget): VisitMethod | null {
    const direct = this.visitFunction(nodeType(object));
    if (direct) return direct;

    if (object != null && typeof object === 'object') {
      let proto: object | null = Object.getPrototypeOf(object as object);
      let depth = 0;
      while (proto != null && depth < 10) {
        const cleaned = constructorName(proto).replace('Node', '');
        if (cleaned) {
          const fn = this.visitFunction(cleaned);
          if (fn) return fn;
        }
        proto = Object.getPrototypeOf(proto);
        depth++;
      }
    }
    return null;
  }

  private visitFunction(typeName: string): VisitMethod | null {
    if (!typeName) return null;
    const fn = (this as unknown as VisitorMethodMap)[`visit${typeName}`];
    return typeof fn === 'function' ? fn : null;
  }
}

/**
 * Indexed accessor for `visit*` methods on a visitor instance. Used by the
 * dynamic-dispatch `visitFunction` helper which looks up handlers by name.
 */
type VisitorMethodMap = Record<string, VisitMethod | undefined>;

/** Read `obj.constructor.name`, returning `''` when absent. */
const constructorName = (obj: object): string => {
  const ctor = (obj as { constructor?: { name?: string } }).constructor;
  return ctor?.name || '';
};

export const nodeType = (object: VisitTarget): string => {
  if (object === null || object === undefined) return 'NilClass';
  if (Array.isArray(object)) return 'Array';
  if (typeof object === 'string') return 'String';
  if (typeof object === 'number') return 'Number';
  if (typeof object === 'boolean') return object ? 'TrueClass' : 'FalseClass';
  if (typeof object === 'bigint') return 'BigInt';
  if (object instanceof Date) return 'Date';
  if (object instanceof Set) return 'Set';
  if (typeof object === 'object') {
    return constructorName(object as object).replace('Node', '') || 'Object';
  }
  return typeof object;
};
