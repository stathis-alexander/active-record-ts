import type { Collector } from '../Collectors';
import type { Node } from '../Nodes/Node';

type NodeVisitor = <C extends Collector>(node: Node | Node[], collector?: C) => C;

export class Visitor {
  accept = <C extends Collector>(object: Node | Node[], collector?: C): C => this.visit(object, collector);

  protected visit = <C extends Collector>(object: Node | Node[], collector?: C): C => {
    let visitFunc: NodeVisitor | null = this.visitFunction.bind(this)(object);

    // If a visit function is not defined for a particular node, look up the inheritance chain to see if one is defined
    // for the node's super class.
    let obj: Object = object;
    let depth = 0;
    while (visitFunc == null && obj != null && depth < 5) {
      obj = Object.getPrototypeOf(obj);
      visitFunc = this.visitFunction(obj);
      depth++;
    }
    if (!visitFunc) throw new Error(`No visit method for node of type: ${nodeType(object)}`);

    return visitFunc.bind(this)(object, collector);
  };

  // @ts-expect-error: this is a little bit nasty, but it's relatively contained, so not too bad.
  private visitFunction = (object: Object): NodeVisitor | null => this[functionName(nodeType(object))];
}

const nodeType = (object: Object) => {
  if (Array.isArray(object)) return 'Array';
  if (!object) return typeof object;

  return object.constructor.name.replace('Node', '');
};

const functionName = (nodeType: string) => {
  if (!nodeType) return '';

  return `visit${nodeType}`;
};
