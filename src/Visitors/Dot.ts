import { last, lastOrThrow } from '../utilities/array';
import { Visitor } from './Visitor';

const quote = (str: string) => str.toString().replace('"', '\"');

type DotNode = {
  name: string;
  fields: string[];
  id: string;
};

type DotEdge = {
  from?: DotNode;
  to?: DotNode;
  name: string;
};

export class Dot extends Visitor {
  private nodes: DotNode[] = [];
  private edges: DotEdge[] = [];
  private nodeStack: DotNode[] = [];
  private edgeStack: DotEdge[] = [];
  private seen: Record<number, boolean> = {};

  protected visitBindParam(o: any) {
    this.visitEdge(o, 'value');
  }

  protected visitAttribute(o: any) {
    this.visitEdge(o, 'value_before_type_cast');
  }

  protected visitArray(o: any) {
    o.forEach((member, index) => {
      this.edge(index, () => this.visitNode(member));
    });
  }

  protected visitSet(o: any) {
    this.visitArray(o.toArray());
  }

  protected visitComment(o: any) {
    this.visitEdge(o, 'values');
  }

  protected visitCase(o: any) {
    this.visitEdge(o, 'case');
    this.visitEdge(o, 'conditions');
    this.visitEdge(o, 'default');
  }

  protected visitEdge(o: any, fieldName: string) {
    return this.edge(fieldName, () => this.visitNode(o[fieldName]()));
  }

  protected visitNode(o: any) {
    if (this.seen[o.__object_id]) {
      lastOrThrow(this.edgeStack).to = o;
      return;
    }

    const node: DotNode = {
      name: o.constructor.name,
      id: o.id,
      fields: [],
    };

    this.seen[o.__object_id] = true;
    this.nodes.push(node);

    return this.withNode(node, () => this.visit(o));
  }

  protected edge(name: string, callback: () => void) {
    const edge: DotEdge = {
      name,
      from: last(this.nodeStack),
    };
    this.edgeStack.push(edge);
    this.edges.push(edge);

    callback();

    return this.edgeStack.pop();
  }

  protected withNode(node: DotNode, callback: () => void) {
    const lastEdge = last(this.edgeStack);
    if (lastEdge) lastEdge.to = node;

    this.nodeStack.push(node);

    callback();

    return this.nodeStack.pop();
  }

  protected toDot() {
    const dotOutputs: string[] = [];

    dotOutputs.push('digraph "Arel" {');
    dotOutputs.push('node [width=0.0375,height=0.25,shape=record];');

    this.nodes.forEach((node) => {
      let label = `<f0>${node.name}`;

      node.fields.forEach((field, index) => {
        label += `|<f${index + 1}>${quote(field)}`;
      });

      dotOutputs.push(`${node.id} [label="${label}"]}`);
    });

    this.edges.forEach((edge) => {
      dotOutputs.push(`${edge.from.id} -> ${edge.to.id} [label="${edge.name}"]`);
    });
    dotOutputs.push('}');

    return dotOutputs.join('\n');
  }
}
